/**
 * Importe les produits d'un CSV fournisseur (scrapé depuis Pieces2mobile.com) vers le catalogue
 * ReparMonPhone : crée automatiquement les gammes/modèles manquants sous la marque "Outils",
 * remplace systématiquement "Pieces2mobile"/"Pieces2mobile.com" par "ReparMonPhone" dans les
 * descriptions, télécharge et réhéberge les images sur Supabase Storage, et évite de créer un
 * doublon si un produit très similaire existe déjà (vérifié en direct sur ta vraie base).
 *
 * MODE DRY-RUN (fortement recommandé en premier) — affiche tout ce qui serait fait, sans rien
 * écrire en base ni télécharger d'image :
 *   node scripts/import-supplier-products.js chemin/vers/fichier.csv --dry-run
 *
 * MODE RÉEL :
 *   node scripts/import-supplier-products.js chemin/vers/fichier.csv
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

// ============================================================
// Table de correspondance : catégorie fournisseur -> Gamme/Modèle ReparMonPhone
// Établie avec Krys à partir de l'échantillon de 80 produits scrapés le 28/08/2026.
// Toute catégorie fournisseur non listée ici retombe sur le fallback ci-dessous et est signalée.
// ============================================================
const CATEGORY_MAP = {
  'Outils > Ouverture > Ventouse': { gamme: 'Accessoires', modele: 'Ouverture' },
  'Outils > Démontage - Montage > Tournevis': { gamme: 'Accessoires', modele: 'Tournevis' },
  'Outils > Tournevis': { gamme: 'Accessoires', modele: 'Tournevis' },
  'Outils > Colle, Adhésif et Dissolvant > Adhésif': { gamme: 'Accessoires', modele: 'Colle' },
  'Outils > Consommable > Colle / Adhésif': { gamme: 'Accessoires', modele: 'Colle' },
  'Outils > Pince > Brucelle': { gamme: 'Accessoires', modele: 'Pince' },
  'Outils > Programmation > Module de reprogrammation': { gamme: 'Reprogrammation', modele: 'Programmation' },
  'Outils > Programmation > Plaque / Nappe de reprogrammation': { gamme: 'Reprogrammation', modele: 'Programmation' },

  'Outils > Autres': { gamme: 'Accessoires', modele: 'Autres' },
  'Outils > Autres > Autres': { gamme: 'Accessoires', modele: 'Autres' },
  'Outils > Autres > Tapis Isolant': { gamme: 'Accessoires', modele: 'Autres' },

  'Outils > Consommable > Soudure': { gamme: 'Accessoires', modele: 'Soudure' },
  'Outils > Consommable > Panne / Buse': { gamme: 'Accessoires', modele: 'Soudure' },
  "Outils > Soudure > Extracteur de fumée": { gamme: 'Accessoires', modele: 'Soudure' },
  'Outils > Soudure > Plaque de rebillage': { gamme: 'Accessoires', modele: 'Soudure' },
  'Outils > Soudure > Séparateur de carte mère': { gamme: 'Accessoires', modele: 'Soudure' },

  'Outils > Kit Outils': { gamme: 'Accessoires', modele: 'Kit Outils' },

  "Outils > Machine > Décolleuse d'écran": { gamme: 'Accessoires', modele: 'Machine' },
  'Outils > Machine > Laser': { gamme: 'Accessoires', modele: 'Machine' },

  'Outils > Redressement et Ajustement': { gamme: 'Accessoires', modele: 'Redressement' },

  'Outils > Testeur et Alimentation  > Chargeur Batterie': { gamme: 'Reprogrammation', modele: 'Testeur' },
  'Outils > Testeur et Alimentation  > Station Alimentation': { gamme: 'Reprogrammation', modele: 'Testeur' },
  'Outils > Testeur et Alimentation  > Testeur carte mère': { gamme: 'Reprogrammation', modele: 'Testeur' },
  'Outils > Testeur et Alimentation  > Testeur écran / Nappe TEST > DIANL DL400 Pro Testeur Ecran': { gamme: 'Reprogrammation', modele: 'Testeur' },
  'Outils > Testeur et Alimentation  > Testeur écran / Nappe TEST > DIANL DL400 Pro Testeur Ecran > DIANL DL400 Pro Nappe Galaxy A': { gamme: 'Reprogrammation', modele: 'Testeur' },
  'Outils > Testeur et Alimentation  > Testeur écran / Nappe TEST > DIANL DL400 Pro Testeur Ecran > DIANL DL400 Pro Nappe iPhone': { gamme: 'Reprogrammation', modele: 'Testeur' },
};
const FALLBACK_MAPPING = { gamme: 'Accessoires', modele: 'Autres' };

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

function parseCsv(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, ''); // retire le BOM
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row = {};
    headers.forEach((h, i) => (row[h] = values[i] ?? ''));
    return row;
  });
}

// Parseur CSV simple gérant les champs entre guillemets avec point-virgule comme séparateur
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

async function getOrCreateModel(brandId, gammeName, modeleName, cache) {
  const cacheKey = `${gammeName}::${modeleName}`;
  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    return { ...cached, lineCreated: false, modelCreated: false };
  }

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
  const filename = `outils/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

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
    console.error('❌ Usage : node scripts/import-supplier-products.js chemin/vers/fichier.csv [--dry-run]');
    process.exit(1);
  }
  if (!fs.existsSync(csvPath)) {
    console.error(`❌ Fichier introuvable : ${csvPath}`);
    process.exit(1);
  }

  console.log(isDryRun ? '🧪 MODE DRY-RUN — aucune écriture ne sera faite.\n' : '⚠️  MODE RÉEL — le catalogue va être modifié.\n');

  const rows = parseCsv(csvPath);
  console.log(`📄 ${rows.length} produits lus dans le CSV fournisseur.\n`);

  const brand = await prisma.brand.findUnique({ where: { slug: 'outils' } });
  if (!brand) {
    console.error('❌ Marque "Outils" introuvable en base (slug attendu : "outils"). Vérifie le slug exact et ajuste le script si besoin.');
    process.exit(1);
  }

  const existingProducts = await prisma.product.findMany({
    where: { model: { productLine: { brandId: brand.id } } },
    select: { title: true, slug: true },
  });
  const existingNormalized = new Map(existingProducts.map((p) => [normalizeForComparison(p.title), p]));

  const modelCache = new Map();
  const unmappedCategories = new Set();

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

    const categorie = row['Categorie']?.trim();
    const mapping = CATEGORY_MAP[categorie];
    if (!mapping) unmappedCategories.add(categorie);
    const { gamme, modele } = mapping || FALLBACK_MAPPING;

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
          pieceType: 'OUTILLAGE',
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
  if (unmappedCategories.size > 0) {
    console.log(`\n${unmappedCategories.size} categorie(s) non prevue(s) dans la table de correspondance`);
    console.log('   (repli automatique sur "Accessoires > Autres") :');
    unmappedCategories.forEach((c) => console.log(`   - ${c}`));
  }
  console.log('--------------------------------\n');

  if (isDryRun) {
    console.log('Pour appliquer reellement cet import, relance sans --dry-run :');
    console.log(`   node scripts/import-supplier-products.js "${csvPath}"\n`);
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
