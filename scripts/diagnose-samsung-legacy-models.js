/**
 * Diagnostic en lecture seule (ne modifie jamais rien) : le dry-run de
 * scripts/add-samsung-reference-codes.js a révélé ~82 modèles Samsung en base qui n'existent PAS
 * dans le CSV fournisseur Samsung.csv — dont plusieurs regroupent PLUSIEURS modèles différents en
 * un seul (ex: "A25 / A34 / A54 / A55", "A32 / A42 / A72", "A5 2017 / J5 2017"...). Ce sont
 * vraisemblablement des catégories héritées d'AVANT cette session (migration initiale du site),
 * antérieures et parallèles aux modèles précis créés par scripts/import-samsung-products.js
 * (ex: "A54 5G (A546B)").
 *
 * Si ces anciens modèles "combo" contiennent encore des vrais produits en base, ils peuvent être
 * la véritable source du mélange de modèles que tu observes (un produit "A25 / A34 / A54 / A55"
 * apparaît à la fois quand on cherche A25, A34, A54 ET A55, alors qu'il ne va peut-être que sur un
 * seul de ces quatre modèles).
 *
 * Ce script liste, pour CHAQUE modèle Samsung sans correspondance CSV : son nombre de produits, et
 * jusqu'à 5 titres de produits en exemple, pour qu'on voie clairement s'il s'agit de vraies pièces à
 * reclasser, ou de modèles vides / obsolètes qu'on peut ignorer ou supprimer.
 *
 *   node scripts/diagnose-samsung-legacy-models.js scripts/Samsung.csv
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: path.join(__dirname, '../.env.migration') });

const prisma = new PrismaClient();
const csvPath = process.argv[2];
const BRAND_SLUG = 'samsung';

function slugifyCompare(s) {
  return s
    .replace(/\+/g, ' plus ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}
function stripParenthetical(s) {
  return s.replace(/\s*\([^)]*\)/g, '').replace(/\s{2,}/g, ' ').trim();
}
function readFileSmartEncoding(filePath) {
  const buffer = fs.readFileSync(filePath);
  const asUtf8 = buffer.toString('utf-8');
  return asUtf8.includes('�') ? buffer.toString('latin1') : asUtf8;
}
function parseCsv(filePath) {
  const content = readFileSmartEncoding(filePath);
  return parse(content, { delimiter: ';', quote: '"', columns: true, bom: true, relax_column_count: true, skip_empty_lines: true, trim: false });
}
function parseCategory(categorie) {
  const parts = categorie.split('>').map((p) => p.trim());
  if (parts.length < 3) return null;
  return { gamme: parts[1], modele: parts[2] };
}

async function main() {
  if (!csvPath || !fs.existsSync(csvPath)) {
    console.error('Usage : node scripts/diagnose-samsung-legacy-models.js scripts/Samsung.csv');
    process.exit(1);
  }

  const rows = parseCsv(csvPath);
  const groupsByGamme = new Map();
  for (const row of rows) {
    const parsed = parseCategory(row['Categorie'] || '');
    if (!parsed) continue;
    const key = slugifyCompare(stripParenthetical(parsed.modele));
    const gammeMap = groupsByGamme.get(parsed.gamme) || new Set();
    gammeMap.add(key);
    groupsByGamme.set(parsed.gamme, gammeMap);
  }
  function gammeHasKey(gammeName, key) {
    const set = groupsByGamme.get(gammeName) || [...groupsByGamme.entries()].find(([g]) => slugifyCompare(g) === slugifyCompare(gammeName))?.[1];
    return set ? set.has(key) : false;
  }

  const brand = await prisma.brand.findUnique({ where: { slug: BRAND_SLUG } });
  const lines = await prisma.productLine.findMany({
    where: { brandId: brand.id },
    include: { models: { include: { products: { select: { title: true }, take: 5, orderBy: { title: 'asc' } }, _count: { select: { products: true } } } } },
  });

  const legacyModels = [];
  for (const line of lines) {
    for (const model of line.models) {
      const key = slugifyCompare(stripParenthetical(model.name));
      if (!gammeHasKey(line.name, key)) {
        legacyModels.push({ line, model });
      }
    }
  }

  legacyModels.sort((a, b) => b.model._count.products - a.model._count.products);

  const totalProducts = legacyModels.reduce((s, { model }) => s + model._count.products, 0);
  const withProducts = legacyModels.filter(({ model }) => model._count.products > 0);
  const empty = legacyModels.filter(({ model }) => model._count.products === 0);

  console.log(`================ ${legacyModels.length} modèle(s) Samsung sans correspondance dans Samsung.csv ================\n`);
  console.log(`${withProducts.length} modèle(s) avec des produits (${totalProducts} produits au total), ${empty.length} modèle(s) vide(s).\n`);

  console.log(`--- Modèles AVEC produits (triés du plus gros au plus petit) ---\n`);
  for (const { line, model } of withProducts) {
    console.log(`[${line.name}] "${model.name}" — ${model._count.products} produit(s)`);
    for (const p of model.products) {
      console.log(`      - ${p.title}`);
    }
    if (model._count.products > 5) console.log(`      ... et ${model._count.products - 5} autre(s)`);
    console.log('');
  }

  if (empty.length > 0) {
    console.log(`--- Modèles VIDES (0 produit) — candidats à la suppression directe ---\n`);
    for (const { line, model } of empty) {
      console.log(`   [${line.name}] "${model.name}"`);
    }
  }
}

main()
  .catch((e) => {
    console.error('💥 Erreur :', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
