/**
 * Traite le SEUL cas resté ambigu après scripts/import-iphone-products.js : les 7 produits du CSV
 * dont la catégorie fournisseur est "Apple > iPhone > iPhone SE (A1723 / A1662 / A1724)".
 *
 * Ces références (A1723 / A1662 / A1724) sont celles du tout premier iPhone SE (2016). En base,
 * ce modèle existe sous le nom "iPhone SE" SANS année (slug "iphone-se") — distinct de
 * "iPhone SE (2020)" et "iPhone SE (2022)". Le script précédent ne pouvait pas choisir entre les
 * trois automatiquement (ambigu une fois la référence entre parenthèses ignorée), donc ces 7
 * lignes avaient été ignorées. Ce script les rattache spécifiquement à "iPhone SE" (slug
 * "iphone-se"), et à personne d'autre.
 *
 * MODE DRY-RUN (recommandé en premier) :
 *   node scripts/import-iphone-se-2016.js scripts/Iphone.csv --dry-run
 *
 * MODE RÉEL :
 *   node scripts/import-iphone-se-2016.js scripts/Iphone.csv
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

const TARGET_MODEL_SLUG = 'iphone-se'; // "iPhone SE" sans année = SE original 2016
const TARGET_CATEGORY_MODELE = 'iPhone SE (A1723 / A1662 / A1724)';
const SUPPLIER_BRAND_NAMES = /pieces ?2 ?mobile(\.com)?/gi;

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

function parseCategory(categorie) {
  const parts = categorie.split('>').map((p) => p.trim());
  if (parts.length < 3) return null;
  return { gamme: parts[1], modele: parts[2] };
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
  const filename = `iphone/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabase.storage.from(SUPABASE_BUCKET).upload(filename, buffer, {
    contentType: res.headers.get('content-type') || 'image/jpeg',
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(filename);
  return data.publicUrl;
}

async function main() {
  if (!csvPath || !fs.existsSync(csvPath)) {
    console.error('Usage : node scripts/import-iphone-se-2016.js chemin/vers/Iphone.csv [--dry-run]');
    process.exit(1);
  }

  console.log(isDryRun ? 'MODE DRY-RUN - aucune ecriture ne sera faite.\n' : 'MODE REEL - le catalogue va etre modifie.\n');

  const model = await prisma.model.findFirst({
    where: { slug: TARGET_MODEL_SLUG, productLine: { name: 'iPhone', brand: { slug: 'apple' } } },
  });
  if (!model) {
    console.error(`❌ Modèle cible introuvable (slug "${TARGET_MODEL_SLUG}" sous Apple > iPhone).`);
    process.exit(1);
  }
  console.log(`Modèle cible : "${model.name}" (id ${model.id}, slug "${model.slug}")\n`);

  const rows = parseCsv(csvPath).filter((row) => {
    const parsed = parseCategory(row['Categorie'] || '');
    return parsed && parsed.modele === TARGET_CATEGORY_MODELE;
  });
  console.log(`${rows.length} ligne(s) CSV avec la catégorie "${TARGET_CATEGORY_MODELE}".\n`);

  const existingProducts = await prisma.product.findMany({
    where: { model: { productLine: { brand: { slug: 'apple' } } } },
    select: { title: true },
  });
  const existingNormalized = new Set(existingProducts.map((p) => normalizeForComparison(p.title)));

  const supabase = !isDryRun && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    : null;

  let created = 0;
  let skippedDuplicate = 0;
  let imageFailures = 0;

  for (const row of rows) {
    const nom = (row['Nom'] || '').trim();
    if (!nom) continue;

    if (existingNormalized.has(normalizeForComparison(nom))) {
      skippedDuplicate++;
      console.log(`   SKIP (doublon probable) : ${nom}`);
      continue;
    }

    console.log(`   ${isDryRun ? 'A CREER' : 'creation'} : ${nom}`);
    created++;

    if (!isDryRun) {
      let imageUrl = null;
      const sourceImageUrl = (row['URL_Image'] || '').trim();
      if (sourceImageUrl && supabase) {
        try {
          imageUrl = await downloadAndUploadImage(sourceImageUrl, supabase);
        } catch (e) {
          imageFailures++;
          console.log(`      image non recuperee (${e.message})`);
        }
      }

      const price = Number((row['Prix_TTC'] || '0').replace(',', '.')) || 0;
      const inStock = (row['Disponibilite'] || '').trim() === 'En stock';
      const shortDesc = (row['Description_Courte'] || '').trim().replace(SUPPLIER_BRAND_NAMES, 'ReparMonPhone') || null;
      const longDesc = (row['Description_Longue'] || '').trim().replace(SUPPLIER_BRAND_NAMES, 'ReparMonPhone') || null;
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
          pieceType: 'AUTRE',
          modelId: model.id,
          showInBoutique: true,
        },
      });
    }
  }

  console.log('\n-------------------------------------------------------------');
  console.log(`Produits ${isDryRun ? 'qui seraient crees' : 'crees'} : ${created}`);
  console.log(`Doublons ignores : ${skippedDuplicate}`);
  if (!isDryRun) console.log(`Echecs de recuperation d'image : ${imageFailures}`);
  console.log('-------------------------------------------------------------\n');

  if (isDryRun) {
    console.log('Pour appliquer réellement :');
    console.log(`   node scripts/import-iphone-se-2016.js "${csvPath}"\n`);
  } else {
    console.log('✅ Terminé.\n');
  }
}

main()
  .catch((e) => {
    console.error('Erreur :', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
