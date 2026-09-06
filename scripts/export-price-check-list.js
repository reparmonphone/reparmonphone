/**
 * Génère un fichier de contrôle (CSV) listant, pour un échantillon de produits, le lien direct
 * vers la fiche sur reparmonphone.fr ET vers la fiche correspondante chez le fournisseur
 * (pieces2mobile.com, colonne URL_Produit du CSV), pour permettre une vérification visuelle
 * côte à côte du prix affiché aux DEUX endroits.
 *
 * L'échantillon couvre :
 *   - les produits actuellement vendus MOINS CHER que le Prix_TTC du CSV (les plus urgents à
 *     vérifier — voir diagnose-pricing-vs-csv.js)
 *   - les produits vendus PLUS CHER que le Prix_TTC du CSV
 *   - quelques produits "normaux" (prix = Prix_TTC du CSV) pris dans des catégories différentes,
 *     pour voir si le Prix_TTC correspond au prix public affiché chez le fournisseur ou non.
 *
 * Écrit scripts/price-check-list.csv (ne modifie jamais la base — script en lecture seule).
 *
 * Usage :
 *   node scripts/export-price-check-list.js
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: path.join(__dirname, '../.env.migration') });

const prisma = new PrismaClient();
const SITE_URL = 'https://www.reparmonphone.fr';

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

function csvField(s) {
  const v = (s ?? '').toString();
  return `"${v.replace(/"/g, '""')}"`;
}

async function main() {
  // 1) Charge tous les CSV : normalizedTitle -> { prixTTC, urlProduit, source }
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
        csvByTitle.set(key, {
          prixTTC: Number((row['Prix_TTC'] || '0').replace(',', '.')) || 0,
          urlProduit: (row['URL_Produit'] || '').trim(),
          source: file,
        });
      }
    }
  }

  // 2) Charge tous les produits en base, calcule l'écart avec le CSV
  const products = await prisma.product.findMany({ select: { title: true, slug: true, price: true } });

  const cheaper = [];
  const pricier = [];
  const equalByCategory = []; // un peu de diversité (écran / caméra / connecteur / accessoire)

  const seenCategoryKeys = new Set();
  const categoryKeyword = (title) => {
    const t = title.toLowerCase();
    if (t.includes('écran') || t.includes('ecran') || t.includes('afficheur')) return 'ecran';
    if (t.includes('caméra') || t.includes('camera')) return 'camera';
    if (t.includes('nappe') || t.includes('connecteur')) return 'connecteur';
    if (t.includes('batterie')) return 'batterie';
    if (t.includes('verre') || t.includes('protection') || t.includes('coque') || t.includes('housse')) return 'accessoire';
    return 'autre';
  };

  for (const p of products) {
    const csv = csvByTitle.get(normalizeTitle(p.title));
    if (!csv) continue;
    const sitePrice = Number(p.price);
    const delta = Math.round((sitePrice - csv.prixTTC) * 100) / 100;
    const row = { title: p.title, slug: p.slug, sitePrice, csvPrice: csv.prixTTC, delta, urlProduit: csv.urlProduit, source: csv.source };

    if (Math.abs(delta) < 0.01) {
      const cat = categoryKeyword(p.title);
      if (!seenCategoryKeys.has(cat) && csv.urlProduit) {
        seenCategoryKeys.add(cat);
        equalByCategory.push(row);
      }
    } else if (delta < 0) {
      cheaper.push(row);
    } else {
      pricier.push(row);
    }
  }

  cheaper.sort((a, b) => a.delta - b.delta);
  pricier.sort((a, b) => b.delta - a.delta);

  const sample = [
    ...cheaper.slice(0, 25).map((r) => ({ ...r, groupe: 'SITE MOINS CHER QUE LE CSV (urgent)' })),
    ...pricier.slice(0, 10).map((r) => ({ ...r, groupe: 'SITE PLUS CHER QUE LE CSV' })),
    ...equalByCategory.map((r) => ({ ...r, groupe: 'PRIX IDENTIQUE AU CSV (a verifier chez le fournisseur)' })),
  ];

  const header = ['Groupe', 'Produit', 'Prix_site', 'Prix_TTC_CSV', 'Ecart', 'Lien_ReparMonPhone', 'Lien_Fournisseur', 'Source_CSV'];
  const lines = [header.map(csvField).join(';')];
  for (const r of sample) {
    if (!r.urlProduit) continue;
    lines.push(
      [
        r.groupe,
        r.title,
        r.sitePrice.toFixed(2).replace('.', ','),
        r.csvPrice.toFixed(2).replace('.', ','),
        r.delta.toFixed(2).replace('.', ','),
        `${SITE_URL}/produit/${r.slug}`,
        r.urlProduit,
        r.source,
      ]
        .map(csvField)
        .join(';')
    );
  }

  const outPath = path.join(__dirname, 'price-check-list.csv');
  fs.writeFileSync(outPath, '﻿' + lines.join('\n'), 'utf-8');

  console.log(`✅ Fichier généré : scripts/price-check-list.csv (${sample.filter((r) => r.urlProduit).length} produits à vérifier)`);
  console.log('Ouvre-le avec Excel : chaque ligne a le lien vers ta fiche produit ET le lien vers la fiche chez le fournisseur.');
  console.log('Compare les deux prix affichés à l\'écran (pas juste le CSV) pour savoir si "Prix_TTC" = prix public fournisseur ou non.');

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
