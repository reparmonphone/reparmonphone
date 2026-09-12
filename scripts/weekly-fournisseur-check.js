/**
 * Vérification hebdomadaire fournisseur (pieces2mobile.com) : à lancer chaque semaine avec un
 * export CSV frais du catalogue fournisseur (colonnes : Nom ; Reference_SKU ; Prix_TTC ; Devise ;
 * Disponibilite ; Marque ; Categorie ; URL_Produit ; URL_Image ; Fichiers_Source).
 *
 * Pour chaque produit déjà rattaché à un SKU fournisseur (Product.supplierSku, voir
 * scripts/backfill-supplier-sku.js) et retrouvé dans le CSV :
 *   - STOCK  : si "En stock"/"Rupture" a changé depuis la dernière vérification -> corrigé
 *              IMMÉDIATEMENT (inStock mis à jour).
 *   - PRIX EN HAUSSE chez le fournisseur -> le prix public est augmenté du MÊME MONTANT en €,
 *     IMMÉDIATEMENT.
 *   - PRIX EN BAISSE chez le fournisseur -> prix public NON touché, à valider depuis /admin/fournisseur.
 *
 * Les produits sans SKU fournisseur (nouveaux, ou jamais matchés) sont recherchés automatiquement
 * dans le CSV par correspondance de titre (scripts/lib/matchSupplier.js) ; un SKU trouvé est
 * enregistré pour les prochaines semaines.
 *
 * Chaque exécution crée un SupplierCheckRun (+ SupplierCheckItem par changement détecté), affiché
 * sur /admin/fournisseur.
 *
 * Ce script écrit TOUJOURS en base (pas de mode aperçu séparé — Krys a demandé une correction
 * immédiate du stock et des hausses de prix). Les baisses de prix, elles, ne sont JAMAIS appliquées
 * automatiquement.
 *
 * Usage :
 *   node scripts/weekly-fournisseur-check.js chemin/vers/fournisseur.csv
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: path.join(__dirname, '../.env.migration') });
const { normalize, buildSupplierIndex, findBestMatch } = require('./lib/matchSupplier');

const prisma = new PrismaClient();

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

function isInStock(disponibilite) {
  return /en stock/i.test((disponibilite || '').trim());
}

async function main() {
  const csvArg = process.argv[2];
  if (!csvArg) {
    console.error('Usage : node scripts/weekly-fournisseur-check.js chemin/vers/fournisseur.csv');
    process.exit(1);
  }
  const csvPath = path.isAbsolute(csvArg) ? csvArg : path.join(process.cwd(), csvArg);
  if (!fs.existsSync(csvPath)) {
    console.error(`Fichier introuvable : ${csvPath}`);
    process.exit(1);
  }

  const rawRows = parseCsv(csvPath);
  console.log(`${rawRows.length} lignes lues dans ${path.basename(csvPath)}.\n`);

  const supplierRows = rawRows
    .map((row) => ({
      nom: (row['Nom'] || '').trim(),
      sku: (row['Reference_SKU'] || '').trim(),
      prix: Number((row['Prix_TTC'] || '0').toString().replace(',', '.')) || 0,
      disponibilite: (row['Disponibilite'] || '').trim(),
    }))
    .filter((r) => r.nom && r.sku);

  const bySku = new Map();
  for (const r of supplierRows) {
    if (!bySku.has(r.sku)) bySku.set(r.sku, r); // en cas de doublon SKU dans le CSV, on garde le premier
  }

  // 1) Produits déjà rattachés à un SKU — jointure directe et rapide.
  const withSku = await prisma.product.findMany({
    where: { supplierSku: { not: null } },
    select: { id: true, title: true, price: true, inStock: true, supplierSku: true, supplierPrice: true },
  });

  // 2) Produits jamais rattachés — on tente une correspondance de titre sur ce CSV, comme pour le
  // backfill initial (voir scripts/backfill-supplier-sku.js), pour rattraper les nouveaux produits
  // ajoutés au catalogue depuis la dernière vérification.
  const withoutSku = await prisma.product.findMany({
    where: { supplierSku: null },
    select: { id: true, title: true, price: true, inStock: true },
  });

  console.log(`${withSku.length} produit(s) déjà rattachés à un SKU fournisseur.`);
  console.log(`${withoutSku.length} produit(s) sans SKU — tentative de correspondance sur ce CSV...`);

  const index = buildSupplierIndex(supplierRows);
  let newlyMatched = 0;
  const freshMatches = []; // { productId, sku }
  for (const p of withoutSku) {
    const match = findBestMatch(p.title, index);
    if (match) {
      freshMatches.push({ id: p.id, title: p.title, price: p.price, inStock: p.inStock, supplierSku: match.row.sku, supplierPrice: null });
      newlyMatched++;
    }
  }
  console.log(`${newlyMatched} nouvelle(s) correspondance(s) trouvée(s) ce run-là.\n`);

  const allTracked = [...withSku, ...freshMatches];

  const items = []; // à insérer dans SupplierCheckItem après création du run
  const productUpdates = []; // { id, data }
  let comparedCount = 0;
  let unchangedCount = 0;
  let notFoundInCsv = 0;

  for (const p of allTracked) {
    const supplierRow = bySku.get(p.supplierSku);
    if (!supplierRow) {
      notFoundInCsv++;
      continue;
    }
    comparedCount++;

    const newSupplierPrice = supplierRow.prix;
    const oldSupplierPrice = p.supplierPrice != null ? Number(p.supplierPrice) : null;
    const newStock = isInStock(supplierRow.disponibilite);
    const oldStock = p.inStock;

    const data = { supplierSku: p.supplierSku, supplierPrice: newSupplierPrice, supplierPriceCheckedAt: new Date() };
    let changed = false;

    // --- Stock : correction immédiate si différent ---
    if (newStock !== oldStock) {
      data.inStock = newStock;
      changed = true;
      items.push({
        productId: p.id,
        type: newStock ? 'RETOUR_STOCK' : 'RUPTURE_STOCK',
        oldStock,
        newStock,
        applied: true,
        reviewed: true,
      });
    }

    // --- Prix : seulement si on a une base de comparaison (semaine précédente connue) ---
    if (oldSupplierPrice != null) {
      const delta = Math.round((newSupplierPrice - oldSupplierPrice) * 100) / 100;
      if (Math.abs(delta) >= 0.01) {
        const currentPublicPrice = Number(p.price);
        if (delta > 0) {
          const newPublicPrice = Math.round((currentPublicPrice + delta) * 100) / 100;
          data.price = newPublicPrice;
          changed = true;
          items.push({
            productId: p.id,
            type: 'PRIX_HAUSSE',
            oldPrice: currentPublicPrice,
            newPrice: newPublicPrice,
            oldSupplierPrice,
            newSupplierPrice,
            applied: true,
            reviewed: true,
          });
        } else {
          items.push({
            productId: p.id,
            type: 'PRIX_BAISSE',
            oldPrice: currentPublicPrice,
            newPrice: currentPublicPrice, // inchangé — à valider par Krys
            oldSupplierPrice,
            newSupplierPrice,
            applied: false,
            reviewed: false,
          });
        }
      }
    }

    if (!changed) {
      // soit rien n'a changé, soit c'est la première fois qu'on voit ce produit (on enregistre
      // juste son prix de référence, sans rien corriger tant qu'on n'a pas de semaine précédente).
      unchangedCount++;
    }

    productUpdates.push({ id: p.id, data });
  }

  const priceHausse = items.filter((i) => i.type === 'PRIX_HAUSSE');
  const priceBaisse = items.filter((i) => i.type === 'PRIX_BAISSE');
  const retourStock = items.filter((i) => i.type === 'RETOUR_STOCK');
  const ruptureStock = items.filter((i) => i.type === 'RUPTURE_STOCK');

  console.log(`${comparedCount} produit(s) rapprochés d'une fiche fournisseur dans ce CSV.`);
  console.log(`${notFoundInCsv} produit(s) rattachés à un SKU absent de ce CSV (non touchés).`);
  console.log(`${unchangedCount} produit(s) sans changement.\n`);
  console.log(`📈 ${priceHausse.length} hausse(s) de prix fournisseur — prix public corrigé automatiquement.`);
  console.log(`📉 ${priceBaisse.length} baisse(s) de prix fournisseur — en attente de ta décision sur /admin/fournisseur.`);
  console.log(`✅ ${retourStock.length} produit(s) redevenu(s) disponible(s) — stock remis à "en stock".`);
  console.log(`⛔ ${ruptureStock.length} produit(s) passé(s) en rupture — stock remis à "rupture".\n`);

  if (priceHausse.length > 0) {
    console.log('--- Hausses appliquées (à vérifier) ---');
    for (const i of priceHausse.slice(0, 20)) {
      console.log(`   ${i.oldPrice.toFixed(2)}€ -> ${i.newPrice.toFixed(2)}€ (fournisseur ${i.oldSupplierPrice.toFixed(2)}€ -> ${i.newSupplierPrice.toFixed(2)}€)`);
    }
    if (priceHausse.length > 20) console.log(`   ... et ${priceHausse.length - 20} autres.`);
    console.log('');
  }

  // --- Écriture en base : produits (SKU/prix/stock), puis le run et ses items ---
  for (const u of productUpdates) {
    await prisma.product.update({ where: { id: u.id }, data: u.data });
  }

  const run = await prisma.supplierCheckRun.create({
    data: {
      sourceFile: path.basename(csvPath),
      totalCompared: comparedCount,
      newlyMatched,
    },
  });

  if (items.length > 0) {
    await prisma.supplierCheckItem.createMany({
      data: items.map((i) => ({ ...i, runId: run.id })),
    });
  }

  console.log(`✅ Vérification terminée (run ${run.id}). Détail sur /admin/fournisseur.`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
