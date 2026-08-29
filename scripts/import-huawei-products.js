/**
 * Importe les produits Huawei d'un CSV fournisseur vers le catalogue ReparMonPhone.
 * Contrairement au script pour "Outils", la catégorie fournisseur suit directement le format
 * "Huawei > Gamme X > Modèle" — la Gamme et le Modèle sont donc déduits automatiquement de
 * chaque ligne, sans table de correspondance manuelle à tenir à jour.
 *
 * Comme pour l'import Outils : remplace "Pieces2mobile"/"Pieces2mobile.com" par "ReparMonPhone"
 * dans les descriptions, télécharge et réhéberge les images sur Supabase, évite les doublons
 * (comparaison par titre normalisé), et cherche les gammes/modèles existants PAR NOM (pas par
 * slug) pour rester robuste à d'éventuelles incohérences slug/nom déjà repérées en base.
 *
 * MODE DRY-RUN (recommandé en premier) :
 *   node scripts/import-huawei-products.js chemin/vers/Huawei.csv --dry-run
 *
 * MODE RÉEL :
 *   node scripts/import-huawei-products.js chemin/vers/Huawei.csv
 */

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.join(__dirname, '../.env.migration') });

const prisma = new PrismaClient();
const isDryRun = process.argv.includes('--dry-run');
const csvPath = process.argv[2];

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || 'products';

const BRAND_SLUG = 'huawei';
const SUPPLIER_BRAND_NAMES = /pieces ?2 ?mobile(\.com)?/gi;

function slugify(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

function normalizeForComparison(s) {
  return slugify(s).replace(/-/g, '');
}

// Lit le fichier en essayant l'UTF-8 d'abord ; si des caractères de remplacement apparaissent
// (signe d'un mauvais décodage), retente en Latin-1 — certains exports fournisseur ne sont
// pas encodés en UTF-8.
function readFileSmartEncoding(filePath) {
  const buffer = fs.readFileSync(filePath);
  const asUtf8 = buffer.toString('utf-8');
  if (asUtf8.includes('\uFFFD')) {
    return buffer.toString('latin1');
  }
  return asUtf8;
}

function parseCsv(filePath) {
  const content = readFileSmartEncoding(filePath).replace(/^\uFEFF/, '');
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row = {};
    headers.forEach((h, i) => (row[h] = values[i] ?? ''));
    return row;
  });
}

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ';' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

// Déduit la Gamme et le Modèle directement depuis la catégorie fournisseur
// (ex: "Huawei > Gamme P > P9 Lite (VNS-L31)" -> gamme="P", modele="P9 Lite (VNS-L31)")
function parseCategory(categorie) {
  const parts = categorie.split(' > ').map((p) => p.trim());
  if (parts.length < 3) return null;
  const gamme = parts[1].replace(/^Gamme\s+/i, '').trim();
  const modele = parts[2];
  return { gamme, modele };
}

async function getOrCreateModel(brandId, gammeName, modeleName, cache) {
  const cacheKey = `${gammeName}::${modeleName}`;
  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    return { ...cached, lineCreated: false, modelCreated: false };
  }

  // Recherche par NOM (pas par slug) : plus robuste aux incohérences slug/nom déjà repérées
  // en base sur ce projet, et évite de recréer un doublon de gamme existante.
  let line = await prisma.productLine.findFirst({ where: { brandId, name: gammeName } });
  let lineCreated = false;
  if (!line) {
    lineCreated = true;
    if (!isDryRun) {
      line = await prisma.productLine.create({ data: { name: gammeName, slug: slugify(gammeName), brandId } });
    }
  }

  let model = line
    ? await prisma.model.findFirst({ where: { productLineId: line.id, name: modeleName } })
    : null;
  let modelCreated = false;
  if (!model) {
    modelCreated = true;
    if (!isDryRun) {
      model = await prisma.model.create({ data: { name: modeleName, slug: slugify(modeleName), productLineId: line.id } });
    }
  }

  const result = { model, lineCreated, modelCreated, gammeName, modeleName };
  cache.set(cacheKey, result);
  return result;
}

async function uniqueProductSlug(title) {
  const base = slugify(title) || 'produit';
  let slug = base;
  let i = 1;
  while (await prisma.product.findUnique({ where: { slug } })) {
    i += 1;
    slug = `${base}-${i}`;
  }
  return slug;
}

async function downloadAndUploadImage(imageUrl, supabase) {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const ext = (imageUrl.split('.').pop() || 'jpg').split('?')[0].slice(0, 5);
  const filename = `huawei/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabase.storage.from(SUPABASE_BUCKET).upload(filename, buffer, {
    contentType: res.headers.get('content-type') || 'image/jpeg',
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(filename);
  return data.publicUrl;
}

async function main() {
  if (!csvPath) {
    console.error('Usage : node scripts/import-huawei-products.js chemin/vers/fichier.csv [--dry-run]');
    process.exit(1);
  }
  if (!fs.existsSync(csvPath)) {
    console.error(`Fichier introuvable : ${csvPath}`);
    process.exit(1);
  }

  console.log(isDryRun ? 'MODE DRY-RUN - aucune ecriture ne sera faite.\n' : 'MODE REEL - le catalogue va etre modifie.\n');

  const rows = parseCsv(csvPath);
  console.log(`${rows.length} produits lus dans le CSV fournisseur.\n`);

  const brand = await prisma.brand.findUnique({ where: { slug: BRAND_SLUG } });
  if (!brand) {
    console.error(`Marque introuvable en base (slug attendu : "${BRAND_SLUG}").`);
    process.exit(1);
  }

  const existingProducts = await prisma.product.findMany({
    where: { model: { productLine: { brandId: brand.id } } },
    select: { title: true, slug: true },
  });
  const existingNormalized = new Map(existingProducts.map((p) => [normalizeForComparison(p.title), p]));

  const modelCache = new Map();
  const skippedNoCategory = [];

  let toCreate = 0;
  let toSkipDuplicate = 0;
  let modelsToCreate = 0;
  let linesToCreate = 0;
  let imageFailures = 0;

  const supabase = !isDryRun && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    : null;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const nom = row['Nom']?.trim();
    if (!nom) continue;

    const parsed = parseCategory(row['Categorie'] || '');
    if (!parsed) {
      skippedNoCategory.push(nom);
      console.log(`[${i + 1}/${rows.length}] ${nom.slice(0, 55).padEnd(55)} -> IGNORE (categorie inattendue: "${row['Categorie']}")`);
      continue;
    }
    const { gamme, modele } = parsed;

    const normalizedTitle = normalizeForComparison(nom);
    const duplicate = existingNormalized.get(normalizedTitle);

    process.stdout.write(`[${i + 1}/${rows.length}] ${nom.slice(0, 55).padEnd(55)} -> ${gamme} > ${modele} `);

    if (duplicate) {
      toSkipDuplicate++;
      console.log(`SKIP (doublon probable : "${duplicate.title}")`);
      continue;
    }

    const { model, lineCreated, modelCreated } = await getOrCreateModel(brand.id, gamme, modele, modelCache);
    if (lineCreated) linesToCreate++;
    if (modelCreated) modelsToCreate++;
    const categoryStatusLabel = lineCreated || modelCreated ? 'NOUVELLE categorie' : '(categorie existante)';

    const price = Number(row['Prix_TTC']?.replace(',', '.')) || 0;
    const inStock = row['Disponibilite']?.trim() === 'En stock';
    const rawDescription = (row['Description'] || '').trim();
    const cleanDescription = rawDescription.replace(SUPPLIER_BRAND_NAMES, 'ReparMonPhone');
    const supplierSourced = SUPPLIER_BRAND_NAMES.test(rawDescription);

    toCreate++;

    if (!isDryRun) {
      let imageUrl = null;
      const sourceImageUrl = row['URL_Image']?.trim();
      if (sourceImageUrl && supabase) {
        try {
          imageUrl = await downloadAndUploadImage(sourceImageUrl, supabase);
        } catch (e) {
          imageFailures++;
          console.log(`   Image non recuperee (${e.message}) - produit cree sans photo.`);
        }
      }

      const slug = await uniqueProductSlug(nom);

      await prisma.product.create({
        data: {
          title: nom,
          slug,
          price,
          inStock,
          shortDescription: cleanDescription || null,
          imageUrl,
          images: imageUrl ? [imageUrl] : [],
          pieceType: 'AUTRE',
          modelId: model.id,
          showInBoutique: true,
          metaDescription: supplierSourced
            ? `[Import fournisseur ${new Date().toISOString().slice(0, 10)} - ref. ${row['Reference_SKU']} - texte source fournisseur, a reformuler]`
            : null,
        },
      });
    }

    console.log(isDryRun ? `(a creer - ${categoryStatusLabel})` : 'cree');
  }

  console.log('\n--------------------------------');
  console.log(`Produits ${isDryRun ? 'qui seraient crees' : 'crees'} : ${toCreate}`);
  console.log(`Doublons probables ignores : ${toSkipDuplicate}`);
  console.log(`Nouvelles gammes ${isDryRun ? 'a creer' : 'creees'} : ${linesToCreate}`);
  console.log(`Nouveaux modeles ${isDryRun ? 'a creer' : 'crees'} : ${modelsToCreate}`);
  if (!isDryRun) console.log(`Echecs de recuperation d'image : ${imageFailures}`);
  if (skippedNoCategory.length > 0) {
    console.log(`\n${skippedNoCategory.length} ligne(s) ignoree(s) (categorie non standard) :`);
    skippedNoCategory.forEach((n) => console.log(`   - ${n}`));
  }
  console.log('--------------------------------\n');

  if (isDryRun) {
    console.log('Pour appliquer reellement cet import, relance sans --dry-run :');
    console.log(`   node scripts/import-huawei-products.js "${csvPath}"\n`);
  } else {
    console.log('Import termine. Pense a relire/reformuler les descriptions marquees "texte source fournisseur"');
    console.log('   dans /admin/produits (elles sont signalees via le champ metaDescription).\n');
  }
}

main()
  .catch((e) => {
    console.error('Erreur :', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
