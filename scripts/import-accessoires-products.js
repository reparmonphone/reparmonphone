/**
 * Importe les 1415 produits "Accessoires" du CSV fournisseur (scripts/Accessoires_Produits.csv) dans
 * le squelette de catégories créé par scripts/create-accessoires-categories.js (marque "Accessoires",
 * gammes/modèles = sous-catégories Niveau2/Niveau3 du CSV).
 *
 * Ce script NE CRÉE JAMAIS de gamme ni de modèle — il retrouve simplement, pour chaque produit, la
 * gamme/modèle déjà créés, en appliquant EXACTEMENT la même règle de regroupement que le script de
 * création (une gamme avec moins de 3 produits dans le CSV est repliée dans "Autres", sous forme de
 * modèle portant son nom d'origine — ex: "Samsung", "Smart Watch"). Si jamais un modèle attendu est
 * introuvable en base (squelette pas encore créé, ou modifié depuis), la ligne est ignorée et listée
 * dans le rapport final — rien n'est jamais deviné.
 *
 * Même logique que scripts/import-ipad-products.js pour le reste : nettoyage des formules marketing
 * fournisseur, détection de doublons par titre normalisé, upload des images vers Supabase Storage.
 *
 * MODE DRY-RUN (fortement recommandé en premier) :
 *   node scripts/import-accessoires-products.js scripts/Accessoires_Produits.csv --dry-run
 *
 * MODE RÉEL :
 *   node scripts/import-accessoires-products.js scripts/Accessoires_Produits.csv
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { PrismaClient } = require('@prisma/client');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.join(__dirname, '../.env.migration') });

const prisma = new PrismaClient();
const isDryRun = process.argv.includes('--dry-run');
const csvPath = process.argv[2];

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || 'products';

const BRAND_NAME = 'Accessoires';
const MIN_LINE_COUNT = 3; // même seuil que scripts/create-accessoires-categories.js

const SUPPLIER_BRAND_NAMES = /pieces ?2 ?mobile(\.com)?/gi;
const NEW_PHRASE = 'Spécialiste français des pièces détachées pour smartphones et tablettes';
const LONG_DESC_BOILERPLATE = /Leader en vente de pi[eè]ces d[ée]tach[ée]es de (?:smartphones|tablettes|montres connect[ée]es) aux particuliers et professionnels/gi;
const SHORT_DESC_BOILERPLATE = /ReparMonPhone,\s*principal grossiste en pi[eè]ces (?:d[ée]tach[ée]es|de rechange) pour mobiles en Europe\.?/gi;
const SHORT_DESC_REPLACEMENT = `ReparMonPhone, ${NEW_PHRASE.charAt(0).toLowerCase()}${NEW_PHRASE.slice(1)}.`;

function cleanDescription(text, { isLong }) {
  if (!text) return text;
  let result = text.replace(SUPPLIER_BRAND_NAMES, 'ReparMonPhone');
  if (isLong) {
    result = result.replace(LONG_DESC_BOILERPLATE, NEW_PHRASE);
  } else {
    result = result.replace(SHORT_DESC_BOILERPLATE, SHORT_DESC_REPLACEMENT);
  }
  return result;
}

function slugify(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

function normalizeForComparison(s) {
  return slugify(s).replace(/-/g, '');
}

function readFileSmartEncoding(filePath) {
  const buffer = fs.readFileSync(filePath);
  const asUtf8 = buffer.toString('utf-8');
  if (asUtf8.includes('�')) return buffer.toString('latin1');
  return asUtf8;
}

function parseCsv(filePath) {
  const content = readFileSmartEncoding(filePath);
  return parse(content, {
    delimiter: ';',
    quote: '"',
    columns: true,
    bom: true,
    relax_column_count: true,
    skip_empty_lines: true,
    trim: false,
  });
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
  const filename = `accessoires/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabase.storage.from(SUPABASE_BUCKET).upload(filename, buffer, {
    contentType: res.headers.get('content-type') || 'image/jpeg',
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(filename);
  return data.publicUrl;
}

// Reproduit EXACTEMENT le regroupement de scripts/create-accessoires-categories.js, pour retrouver
// pour chaque ligne du CSV la gamme/modèle qui a réellement été créé en base.
function buildDistribution(rows) {
  const lineMap = new Map(); // niveau2 -> { count, subs: Map<niveau3, count>, emptyCount }
  for (const row of rows) {
    const l2 = (row.Categorie_Niveau2 || '').trim() || 'Autres';
    const l3 = (row.Categorie_Niveau3 || '').trim();
    if (!lineMap.has(l2)) lineMap.set(l2, { count: 0, subs: new Map(), emptyCount: 0 });
    const entry = lineMap.get(l2);
    entry.count++;
    if (l3) entry.subs.set(l3, (entry.subs.get(l3) || 0) + 1);
    else entry.emptyCount++;
  }
  return lineMap;
}

function resolveTarget(l2raw, l3raw, distribution, smallLineNames) {
  const l2 = (l2raw || '').trim() || 'Autres';
  const l3 = (l3raw || '').trim();

  if (smallLineNames.has(l2)) {
    return { lineName: 'Autres', modelName: l2 };
  }
  if (l3) {
    return { lineName: l2, modelName: l3 };
  }
  const entry = distribution.get(l2);
  const hasNamedSubs = entry && entry.subs.size > 0;
  return { lineName: l2, modelName: hasNamedSubs ? 'Autres' : l2 };
}

async function main() {
  if (!csvPath) {
    console.error('Usage : node scripts/import-accessoires-products.js scripts/Accessoires_Produits.csv [--dry-run]');
    process.exit(1);
  }
  if (!fs.existsSync(csvPath)) {
    console.error(`Fichier introuvable : ${csvPath}`);
    process.exit(1);
  }

  console.log(isDryRun ? 'MODE DRY-RUN - aucune ecriture ne sera faite.\n' : 'MODE REEL - le catalogue va etre modifie.\n');

  const allRows = parseCsv(csvPath);
  console.log(`${allRows.length} ligne(s) lue(s) dans le CSV fournisseur.\n`);

  const rows = allRows.filter((r) => (r.Categorie_Niveau1 || '').trim() === 'Accessoires');
  console.log(`${rows.length} ligne(s) dans le périmètre "Accessoires" (les autres — Samsung, Apple, Sony... — sont ignorées).\n`);

  const distribution = buildDistribution(rows);
  const smallLineNames = new Set(
    [...distribution.entries()].filter(([name, e]) => name !== 'Autres' && e.count < MIN_LINE_COUNT).map(([name]) => name)
  );

  const brand = await prisma.brand.findFirst({ where: { name: BRAND_NAME } });
  if (!brand) {
    console.error(`Marque "${BRAND_NAME}" introuvable en base — lance d'abord scripts/create-accessoires-categories.js --apply.`);
    process.exit(1);
  }

  const lines = await prisma.productLine.findMany({ where: { brandId: brand.id }, include: { models: true } });
  const lineByName = new Map(lines.map((l) => [l.name, l]));

  const existingProducts = await prisma.product.findMany({
    where: { model: { productLine: { brandId: brand.id } } },
    select: { title: true },
  });
  const existingNormalized = new Set(existingProducts.map((p) => normalizeForComparison(p.title)));

  const unmatched = new Map(); // "gamme::modele" -> { gamme, modele, count, reason, sample }

  let toCreate = 0;
  let toSkipDuplicate = 0;
  let toSkipUnmatched = 0;
  let imageFailures = 0;

  const supabase = !isDryRun && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    : null;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const nom = (row['Nom'] || '').trim();
    if (!nom) continue;

    const target = resolveTarget(row.Categorie_Niveau2, row.Categorie_Niveau3, distribution, smallLineNames);
    const line = lineByName.get(target.lineName);
    const model = line && line.models.find((m) => m.name === target.modelName);

    if (!model) {
      const key = `${target.lineName}::${target.modelName}`;
      const entry = unmatched.get(key) || {
        gamme: target.lineName,
        modele: target.modelName,
        count: 0,
        reason: !line ? `gamme "${target.lineName}" introuvable en base` : `modèle "${target.modelName}" introuvable dans la gamme "${target.lineName}"`,
        sample: nom,
      };
      entry.count++;
      unmatched.set(key, entry);
      toSkipUnmatched++;
      continue;
    }

    const normalizedTitle = normalizeForComparison(nom);
    if (existingNormalized.has(normalizedTitle)) {
      toSkipDuplicate++;
      continue;
    }

    toCreate++;

    if (!isDryRun) {
      let imageUrl = null;
      const sourceImageUrl = (row['URL_Image'] || '').trim();
      if (sourceImageUrl && supabase) {
        try {
          imageUrl = await downloadAndUploadImage(sourceImageUrl, supabase);
        } catch (e) {
          imageFailures++;
          console.log(`[${i + 1}/${rows.length}] ${nom.slice(0, 55)} -> image non recuperee (${e.message})`);
        }
      }

      const price = Number((row['Prix_TTC'] || '0').replace(',', '.')) || 0;
      const inStock = (row['Disponibilite'] || '').trim() === 'En stock';
      const shortDesc = cleanDescription((row['Description_Courte'] || '').trim(), { isLong: false }) || null;
      const longDesc = cleanDescription((row['Description_Longue'] || '').trim(), { isLong: true }) || null;
      const slug = await uniqueProductSlug(nom);

      await prisma.product.create({
        data: {
          title: nom,
          slug,
          price,
          inStock,
          shortDescription: shortDesc,
          description: longDesc,
          imageUrl,
          images: imageUrl ? [imageUrl] : [],
          pieceType: 'ACCESSOIRE',
          modelId: model.id,
          showInBoutique: true,
        },
      });
      existingNormalized.add(normalizedTitle); // évite un doublon si le même titre revient plus loin dans le CSV
    }

    if ((i + 1) % 100 === 0 || i === rows.length - 1) {
      console.log(`... ${i + 1}/${rows.length} lignes traitées`);
    }
  }

  console.log('\n================ RAPPORT ================\n');

  if (unmatched.size > 0) {
    console.log(`❌ ${unmatched.size} gamme/modèle introuvable(s) en base — ${toSkipUnmatched} produit(s) ignoré(s) :\n`);
    for (const { gamme, modele, count, reason, sample } of unmatched.values()) {
      console.log(`   "${gamme} > ${modele}" (${count} produit(s), ex: "${sample.slice(0, 50)}") -> ${reason}`);
    }
    console.log('\n   -> si ce squelette a changé depuis, relance scripts/create-accessoires-categories.js --apply avant de refaire cet import.\n');
  } else {
    console.log('✅ Toutes les lignes ont trouvé leur gamme/modèle en base.\n');
  }

  console.log('-------------------------------------------------------------');
  console.log(`Produits ${isDryRun ? 'qui seraient crees' : 'crees'} : ${toCreate}`);
  console.log(`Doublons probables ignores (titre déjà en base) : ${toSkipDuplicate}`);
  console.log(`Produits ignorés (gamme/modèle introuvable) : ${toSkipUnmatched}`);
  if (!isDryRun) console.log(`Echecs de recuperation d'image : ${imageFailures}`);
  console.log('-------------------------------------------------------------\n');

  if (isDryRun) {
    console.log('Relis bien le rapport ci-dessus avant de lancer en réel.');
    console.log('Pour appliquer réellement cet import :');
    console.log(`   node scripts/import-accessoires-products.js "${csvPath}"\n`);
  } else {
    console.log('Import terminé.\n');
  }
}

main()
  .catch((e) => {
    console.error('Erreur :', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
