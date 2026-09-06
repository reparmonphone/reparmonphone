/**
 * Diagnostic en lecture seule : compare le prix ACTUELLEMENT en base (product.price) de chaque
 * produit avec le "Prix_TTC" du CSV fournisseur d'où il vient, pour vérifier si le prix affiché
 * sur le site correspond bien à ce que disent les fichiers CSV dans scripts/.
 *
 * Contexte : tous les scripts d'import (import-iphone-products.js, import-samsung-products.js,
 * import-huawei-products.js, import-ipad-products.js, import-accessoires-products.js,
 * import-supplier-products.js) font tous la même chose :
 *   const price = Number(row['Prix_TTC'].replace(',', '.'))
 * c'est-à-dire qu'ils copient TEL QUEL le "Prix_TTC" du CSV comme prix de vente du site — AUCUNE
 * marge n'est ajoutée nulle part dans le code. Donc en théorie, prix du site == Prix_TTC du CSV.
 *
 * Ce script vérifie si c'est bien le cas partout, ou si certains produits ont un prix en base
 * différent (plus bas = argent perdu si Prix_TTC est votre prix de revient) du Prix_TTC actuel du
 * CSV.
 *
 * Usage :
 *   node scripts/diagnose-pricing-vs-csv.js
 *   node scripts/diagnose-pricing-vs-csv.js ecran-iphone-xs-incell-standard   (un seul produit, par slug)
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: path.join(__dirname, '../.env.migration') });

const prisma = new PrismaClient();

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
  const onlySlug = process.argv[2] || null;

  // 1) Charge tous les CSV en un seul dictionnaire normalizedTitle -> { prixTTC, source, nom }
  const csvByTitle = new Map();
  let csvRowsTotal = 0;
  for (const file of CSV_FILES) {
    const filePath = path.join(__dirname, file);
    if (!fs.existsSync(filePath)) {
      console.log(`(ignoré, fichier absent : ${file})`);
      continue;
    }
    const rows = parseCsv(filePath);
    csvRowsTotal += rows.length;
    for (const row of rows) {
      const nom = (row['Nom'] || '').trim();
      if (!nom) continue;
      const prixTTC = Number((row['Prix_TTC'] || '0').replace(',', '.')) || 0;
      const key = normalizeTitle(nom);
      if (!csvByTitle.has(key)) {
        csvByTitle.set(key, { prixTTC, source: file, nom });
      }
    }
  }
  console.log(`${csvRowsTotal} lignes lues dans ${CSV_FILES.length} fichier(s) CSV, ${csvByTitle.size} titres uniques.\n`);

  // 2) Charge les produits en base (un seul, ou tout le catalogue)
  const products = onlySlug
    ? await prisma.product.findMany({ where: { slug: onlySlug }, select: { id: true, title: true, slug: true, price: true } })
    : await prisma.product.findMany({ select: { id: true, title: true, slug: true, price: true } });

  if (onlySlug && products.length === 0) {
    console.error(`Aucun produit trouvé pour le slug "${onlySlug}".`);
    return prisma.$disconnect();
  }

  let noMatch = 0;
  let equal = 0;
  let cheaper = 0; // prix du site < Prix_TTC du CSV (perte potentielle)
  let pricier = 0; // prix du site > Prix_TTC du CSV
  const cheaperList = [];
  const pricierList = [];

  for (const p of products) {
    const key = normalizeTitle(p.title);
    const csv = csvByTitle.get(key);
    const sitePrice = Number(p.price);

    if (!csv) {
      noMatch++;
      if (onlySlug) console.log(`❓ "${p.title}" : aucune correspondance trouvée dans les CSV.`);
      continue;
    }

    const delta = Math.round((sitePrice - csv.prixTTC) * 100) / 100;

    if (onlySlug) {
      console.log(`Produit      : "${p.title}"`);
      console.log(`Prix site    : ${sitePrice.toFixed(2)} €`);
      console.log(`Prix_TTC CSV : ${csv.prixTTC.toFixed(2)} € (source : ${csv.source})`);
      console.log(`Écart        : ${delta > 0 ? '+' : ''}${delta.toFixed(2)} €`);
      continue;
    }

    if (Math.abs(delta) < 0.01) {
      equal++;
    } else if (delta < 0) {
      cheaper++;
      cheaperList.push({ title: p.title, slug: p.slug, sitePrice, csvPrice: csv.prixTTC, delta });
    } else {
      pricier++;
      pricierList.push({ title: p.title, slug: p.slug, sitePrice, csvPrice: csv.prixTTC, delta });
    }
  }

  if (onlySlug) {
    await prisma.$disconnect();
    return;
  }

  console.log('================ RESUME CATALOGUE COMPLET ================\n');
  console.log(`${products.length} produits en base au total.`);
  console.log(`${noMatch} produit(s) sans correspondance dans les CSV (créés autrement, ou titre modifié depuis).`);
  console.log(`${equal} produit(s) avec un prix EXACTEMENT égal au Prix_TTC du CSV (comportement normal des scripts d'import).`);
  console.log(`${cheaper} produit(s) VENDUS MOINS CHER que le Prix_TTC actuel du CSV (perte potentielle si Prix_TTC = votre coût).`);
  console.log(`${pricier} produit(s) vendus PLUS CHER que le Prix_TTC du CSV (marge ajoutée, ou CSV changé depuis).\n`);

  if (cheaperList.length > 0) {
    cheaperList.sort((a, b) => a.delta - b.delta);
    console.log(`--- Top 20 des plus gros écarts "site moins cher que le CSV" ---`);
    for (const p of cheaperList.slice(0, 20)) {
      console.log(`   "${p.title}" : site ${p.sitePrice.toFixed(2)}€ vs CSV ${p.csvPrice.toFixed(2)}€ (${p.delta.toFixed(2)}€) — slug: ${p.slug}`);
    }
    console.log('');
  }

  if (pricierList.length > 0) {
    pricierList.sort((a, b) => b.delta - a.delta);
    console.log(`--- Top 10 des plus gros écarts "site plus cher que le CSV" ---`);
    for (const p of pricierList.slice(0, 10)) {
      console.log(`   "${p.title}" : site ${p.sitePrice.toFixed(2)}€ vs CSV ${p.csvPrice.toFixed(2)}€ (+${p.delta.toFixed(2)}€) — slug: ${p.slug}`);
    }
    console.log('');
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
