/**
 * Remplit UNE FOIS Product.supplierSku / supplierPrice / supplierPriceCheckedAt pour tout le
 * catalogue existant, à partir de scripts/supplier-sku-backfill.csv (colonnes : Slug ; SKU_Fournisseur ;
 * Score_Correspondance ; Prix_Fournisseur) — ce fichier a été généré une fois par correspondance de
 * titre entre l'export produits du site et le catalogue fournisseur (pieces2mobile.com), avec un
 * contrôle qualité strict (voir scripts/lib/matchSupplier.js pour la méthode).
 *
 * Après ce backfill, scripts/weekly-fournisseur-check.js n'a plus besoin de deviner le SKU des
 * produits déjà rattachés — seuls les nouveaux produits (ou ceux jamais matchés) repassent par une
 * correspondance automatique à chaque exécution hebdomadaire.
 *
 * PRÉREQUIS : avoir fait tourner `npm run db:push` après la mise à jour de prisma/schema.prisma
 * (ajout des champs supplierSku / supplierPrice / supplierPriceCheckedAt sur Product, et des tables
 * supplier_check_runs / supplier_check_items).
 *
 * MODE APERÇU (par défaut, aucune écriture) :
 *   node scripts/backfill-supplier-sku.js
 *
 * MODE RÉEL :
 *   node scripts/backfill-supplier-sku.js --apply
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: path.join(__dirname, '../.env.migration') });

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');
const CSV_PATH = path.join(__dirname, 'supplier-sku-backfill.csv');

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

  if (!fs.existsSync(CSV_PATH)) {
    console.error(`Fichier introuvable : ${CSV_PATH}`);
    process.exit(1);
  }

  const rows = parseCsv(CSV_PATH);
  console.log(`${rows.length} lignes dans supplier-sku-backfill.csv.`);

  const products = await prisma.product.findMany({ select: { id: true, slug: true, supplierSku: true } });
  const bySlug = new Map(products.map((p) => [p.slug, p]));

  let noMatch = 0;
  let alreadySet = 0;
  const toUpdate = [];

  for (const row of rows) {
    const slug = (row['Slug'] || '').trim();
    const sku = (row['SKU_Fournisseur'] || '').trim();
    const prix = Number((row['Prix_Fournisseur'] || '0').replace(',', '.')) || 0;
    if (!slug || !sku) continue;

    const product = bySlug.get(slug);
    if (!product) {
      noMatch++;
      continue;
    }
    if (product.supplierSku === sku) {
      alreadySet++;
      continue;
    }
    toUpdate.push({ id: product.id, slug, sku, prix });
  }

  console.log(`${products.length} produits en base au total.`);
  console.log(`${noMatch} ligne(s) du CSV sans produit correspondant en base (slug introuvable).`);
  console.log(`${alreadySet} produit(s) déjà à jour.`);
  console.log(`${toUpdate.length} produit(s) ${APPLY ? 'vont recevoir' : 'recevraient'} leur SKU fournisseur.\n`);

  console.log('--- Aperçu (10 premiers) ---');
  for (const p of toUpdate.slice(0, 10)) {
    console.log(`   ${p.slug} -> SKU ${p.sku} (${p.prix.toFixed(2)}€)`);
  }

  if (!APPLY) {
    console.log('\nAperçu uniquement — relance avec --apply pour écrire ces SKU en base.');
    await prisma.$disconnect();
    return;
  }

  const now = new Date();
  let updated = 0;
  for (const p of toUpdate) {
    await prisma.product.update({
      where: { id: p.id },
      data: { supplierSku: p.sku, supplierPrice: p.prix, supplierPriceCheckedAt: now },
    });
    updated++;
  }

  console.log(`\n✅ ${updated} produit(s) mis à jour avec leur SKU fournisseur.`);
  console.log('Terminé. Tu peux maintenant lancer scripts/weekly-fournisseur-check.js chaque semaine.');

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
