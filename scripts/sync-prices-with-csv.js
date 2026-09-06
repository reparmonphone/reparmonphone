/**
 * Remet à jour le prix (product.price) de tous les produits dont le prix en base est différent du
 * "Prix_TTC" ACTUEL des CSV fournisseur (scripts/*.csv) — qu'il s'agisse d'anciens produits dont le
 * prix est resté figé depuis avant le gros import, ou de produits plus récents dont le CSV a changé
 * depuis.
 *
 * Ne touche JAMAIS regularPrice (prix barré) — seulement price. Ne touche jamais un produit sans
 * correspondance dans les CSV (produit créé/renommé autrement).
 *
 * IMPORTANT : ceci aligne ton prix de vente sur le prix PUBLIC actuel de pieces2mobile.com. Ça ne
 * rajoute AUCUNE marge — voir la discussion sur la marge séparément.
 *
 * MODE APERÇU (par défaut, aucune écriture) :
 *   node scripts/sync-prices-with-csv.js
 *
 * MODE RÉEL :
 *   node scripts/sync-prices-with-csv.js --apply
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: path.join(__dirname, '../.env.migration') });

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

const CSV_FILES = [
  'Iphone.csv',
  'Samsung.csv',
  'Huawei.csv',
  'Xiaomi.csv',
  'Ipads.csv',
  'Accessoires_Produits.csv',
  'pieces2mobile_produits_complet.csv',
];

function slugify(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}
function normalizeTitle(s) {
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

async function main() {
  console.log(APPLY ? 'MODE REEL - la base va etre modifiee.\n' : 'MODE APERCU - aucune ecriture ne sera faite.\n');

  const csvByTitle = new Map();
  for (const file of CSV_FILES) {
    const filePath = path.join(__dirname, file);
    if (!fs.existsSync(filePath)) continue;
    const rows = parseCsv(filePath);
    for (const row of rows) {
      const nom = (row['Nom'] || '').trim();
      if (!nom) continue;
      const key = normalizeTitle(nom);
      if (!csvByTitle.has(key)) {
        csvByTitle.set(key, Number((row['Prix_TTC'] || '0').replace(',', '.')) || 0);
      }
    }
  }

  const products = await prisma.product.findMany({ select: { id: true, title: true, slug: true, price: true } });

  let unchanged = 0;
  let noMatch = 0;
  const toUpdate = [];

  for (const p of products) {
    const csvPrice = csvByTitle.get(normalizeTitle(p.title));
    if (csvPrice === undefined) {
      noMatch++;
      continue;
    }
    const sitePrice = Number(p.price);
    const delta = Math.round((csvPrice - sitePrice) * 100) / 100;
    if (Math.abs(delta) < 0.01) {
      unchanged++;
      continue;
    }
    toUpdate.push({ id: p.id, title: p.title, slug: p.slug, oldPrice: sitePrice, newPrice: csvPrice, delta });
  }

  const increases = toUpdate.filter((p) => p.delta > 0);
  const decreases = toUpdate.filter((p) => p.delta < 0);

  console.log(`${products.length} produits en base au total.`);
  console.log(`${noMatch} produit(s) sans correspondance CSV — non touchés.`);
  console.log(`${unchanged} produit(s) déjà à jour — non touchés.`);
  console.log(`${toUpdate.length} produit(s) ${APPLY ? 'à mettre à jour' : 'seraient mis à jour'} :`);
  console.log(`   - ${increases.length} vont AUGMENTER (prix remonté au niveau actuel du fournisseur)`);
  console.log(`   - ${decreases.length} vont BAISSER (le fournisseur a baissé son prix depuis)\n`);

  increases.sort((a, b) => b.delta - a.delta);
  decreases.sort((a, b) => a.delta - b.delta);

  console.log('--- Aperçu des 15 plus grosses hausses ---');
  for (const p of increases.slice(0, 15)) {
    console.log(`   "${p.title}" : ${p.oldPrice.toFixed(2)}€ -> ${p.newPrice.toFixed(2)}€ (+${p.delta.toFixed(2)}€)`);
  }
  console.log('\n--- Aperçu des 15 plus grosses baisses ---');
  for (const p of decreases.slice(0, 15)) {
    console.log(`   "${p.title}" : ${p.oldPrice.toFixed(2)}€ -> ${p.newPrice.toFixed(2)}€ (${p.delta.toFixed(2)}€)`);
  }

  if (!APPLY) {
    console.log('\nAperçu uniquement — relance avec --apply pour appliquer réellement cette mise à jour.');
    await prisma.$disconnect();
    return;
  }

  for (const p of toUpdate) {
    await prisma.product.update({ where: { id: p.id }, data: { price: p.newPrice } });
  }
  console.log(`\n✅ ${toUpdate.length} prix mis à jour.`);
  console.log('Terminé.');

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
