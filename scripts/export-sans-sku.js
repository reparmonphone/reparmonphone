/**
 * Génère la liste À JOUR (interrogée en direct dans la base) de tous les produits qui n'ont
 * PAS de SKU fournisseur (Product.supplierSku vide ou null) — remplace les anciennes versions
 * "produits-sans-sku-fournisseur-v2.csv" qui étaient basées sur un export CSV figé au moment
 * de la simulation de matching, donc obsolètes dès qu'un backfill ou un import a eu lieu depuis.
 *
 * USAGE :
 *   node scripts/export-sans-sku.js
 *
 * Écrit scripts/produits-sans-sku-fournisseur-v3.csv (avec BOM UTF-8, pour un affichage correct
 * des accents dans Excel).
 */

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: path.join(__dirname, '../.env.migration') });

const prisma = new PrismaClient();
const OUT_PATH = path.join(__dirname, 'produits-sans-sku-fournisseur-v3.csv');

function csvEscape(value) {
  const s = String(value ?? '');
  if (s.includes(';') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

async function main() {
  const products = await prisma.product.findMany({
    select: {
      title: true,
      slug: true,
      price: true,
      inStock: true,
      pieceType: true,
      quality: true,
      supplierSku: true,
      model: {
        select: {
          name: true,
          productLine: {
            select: {
              name: true,
              brand: { select: { name: true } },
            },
          },
        },
      },
    },
    orderBy: { title: 'asc' },
  });

  console.log(`${products.length} produits en base au total.`);

  const sansSku = products.filter((p) => !p.supplierSku || !p.supplierSku.trim());

  console.log(`${products.length - sansSku.length} produit(s) ont déjà un SKU fournisseur.`);
  console.log(`${sansSku.length} produit(s) SANS SKU fournisseur.`);

  // Répartition par marque, pour voir d'un coup d'œil d'où viennent les manques
  const parMarque = new Map();
  for (const p of sansSku) {
    const marque = p.model?.productLine?.brand?.name || '(inconnue)';
    parMarque.set(marque, (parMarque.get(marque) || 0) + 1);
  }
  console.log('\nRépartition par marque :');
  for (const [marque, count] of [...parMarque.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`   ${marque} : ${count}`);
  }

  const header = ['Titre', 'Marque', 'Gamme', 'Modèle', 'Prix', 'En stock', 'Slug', 'Type_piece', 'Qualite'];
  const lines = [header.join(';')];
  for (const p of sansSku) {
    lines.push(
      [
        csvEscape(p.title),
        csvEscape(p.model?.productLine?.brand?.name || ''),
        csvEscape(p.model?.productLine?.name || ''),
        csvEscape(p.model?.name || ''),
        csvEscape(Number(p.price).toFixed(2)),
        csvEscape(p.inStock ? 'Oui' : 'Non'),
        csvEscape(p.slug),
        csvEscape(p.pieceType || ''),
        csvEscape(p.quality || ''),
      ].join(';')
    );
  }

  const BOM = '﻿';
  fs.writeFileSync(OUT_PATH, BOM + lines.join('\n') + '\n', 'utf-8');
  console.log(`\n✅ Fichier écrit : ${OUT_PATH}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
