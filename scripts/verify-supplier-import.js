/**
 * Vérifie (LECTURE SEULE, rien n'est modifié) les produits importés aujourd'hui par
 * scripts/import-supplier-absents.js.
 *
 * Contrôles :
 *   1. Combien de produits ont été créés, par marque / gamme
 *   2. Textes : restes de "Pieces2mobile", "Envois gratuits dès 35", "Comptes professionnels", "Leader en vente"
 *      + présence du nouveau texte "Livraison gratuite dès 250€"
 *   3. Produits sans photo, sans description, sans description courte
 *   4. Prix : à 0 €, ou > 300 € hors écran/châssis
 *   5. Type de pièce : répartition (et combien restent "AUTRE")
 *   6. Doublons de titre (dans tout le catalogue)
 *   7. Gammes / modèles créés aujourd'hui, et modèles créés qui n'ont finalement aucun produit
 *   8. Modèles sans photo parmi ceux créés aujourd'hui
 *
 * Usage :
 *   node scripts/verify-supplier-import.js                    (produits créés depuis aujourd'hui 00:00)
 *   node scripts/verify-supplier-import.js --since 2026-10-04 (autre date de départ, AAAA-MM-JJ)
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.migration') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const argv = process.argv;
const sinceArg = argv.includes('--since') ? argv[argv.indexOf('--since') + 1] : null;
const since = sinceArg ? new Date(`${sinceArg}T00:00:00`) : (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();

const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '');
const ok = (b) => (b ? '✅' : '⚠️ ');

async function main() {
  console.log(`Vérification des produits créés depuis le ${since.toLocaleString('fr-FR')}\n`);

  const products = await prisma.product.findMany({
    where: { createdAt: { gte: since } },
    include: { model: { include: { productLine: { include: { brand: true } } } } },
  });
  console.log(`1. ${products.length} produit(s) créé(s) depuis cette date.`);
  if (products.length === 0) {
    console.log('   Rien à vérifier (essaie --since avec une date plus ancienne).');
    return;
  }
  const byBrand = new Map();
  for (const p of products) {
    const key = `${p.model.productLine.brand.name} > ${p.model.productLine.name}`;
    byBrand.set(key, (byBrand.get(key) || 0) + 1);
  }
  [...byBrand.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`   ${String(v).padStart(4)}  ${k}`));

  // 2. textes
  console.log('\n2. Textes');
  const txt = (p) => `${p.shortDescription || ''} ${p.description || ''}`;
  const checks = [
    ['"Pieces2mobile" restant', /pieces ?2 ?mobile/i],
    ['"Envois gratuits dès 35" restant', /Envois gratuits dès 35/i],
    ['"Comptes professionnels" restant', /Comptes professionnels/i],
    ['"Leader en vente" restant', /Leader en vente/i],
  ];
  for (const [label, re] of checks) {
    const bad = products.filter((p) => re.test(txt(p)));
    console.log(`   ${ok(bad.length === 0)} ${label} : ${bad.length}`);
    bad.slice(0, 3).forEach((p) => console.log(`        - ${p.title.slice(0, 70)}`));
  }
  const withNew = products.filter((p) => /Livraison gratuite dès 250€/.test(txt(p))).length;
  console.log(`   ℹ️  Texte "Livraison gratuite dès 250€" présent sur ${withNew} produit(s) (normal : seulement ceux dont le fournisseur avait une phrase de livraison).`);

  // 3. photos / descriptions
  console.log('\n3. Contenu');
  const noImg = products.filter((p) => !p.imageUrl);
  const noDesc = products.filter((p) => !p.description || p.description.trim().length < 20);
  const noShort = products.filter((p) => !p.shortDescription);
  console.log(`   ${ok(noImg.length === 0)} sans photo : ${noImg.length}`);
  noImg.slice(0, 5).forEach((p) => console.log(`        - ${p.title.slice(0, 70)}`));
  console.log(`   ${ok(noDesc.length === 0)} sans description longue : ${noDesc.length}`);
  noDesc.slice(0, 5).forEach((p) => console.log(`        - ${p.title.slice(0, 70)}`));
  console.log(`   ${ok(noShort.length === 0)} sans description courte : ${noShort.length}`);

  // 4. prix
  console.log('\n4. Prix');
  const zero = products.filter((p) => Number(p.price) <= 0);
  const high = products.filter((p) => Number(p.price) > 300 && p.pieceType !== 'ECRAN' && p.pieceType !== 'CHASSIS');
  console.log(`   ${ok(zero.length === 0)} prix à 0 € : ${zero.length}`);
  zero.slice(0, 5).forEach((p) => console.log(`        - ${p.title.slice(0, 70)}`));
  console.log(`   ${ok(high.length === 0)} > 300 € hors écran/châssis : ${high.length}`);
  high.slice(0, 5).forEach((p) => console.log(`        - ${p.title.slice(0, 70)} (${Number(p.price).toFixed(2)} €)`));
  const prices = products.map((p) => Number(p.price)).sort((a, b) => a - b);
  console.log(`   ℹ️  min ${prices[0].toFixed(2)} € — médiane ${prices[Math.floor(prices.length / 2)].toFixed(2)} € — max ${prices[prices.length - 1].toFixed(2)} €`);

  // 5. types de pièce
  console.log('\n5. Types de pièce');
  const byType = new Map();
  for (const p of products) byType.set(p.pieceType, (byType.get(p.pieceType) || 0) + 1);
  [...byType.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`   ${String(v).padStart(4)}  ${k}`));
  const autre = products.filter((p) => p.pieceType === 'AUTRE');
  if (autre.length) {
    console.log(`   ℹ️  ${autre.length} en "AUTRE" (exemples) :`);
    autre.slice(0, 8).forEach((p) => console.log(`        - ${p.title.slice(0, 70)}`));
  }

  // 6. doublons
  console.log('\n6. Doublons de titre dans tout le catalogue');
  const all = await prisma.product.findMany({ select: { id: true, title: true, slug: true, createdAt: true, price: true } });
  const seen = new Map();
  for (const p of all) {
    const k = norm(p.title);
    if (!seen.has(k)) seen.set(k, []);
    seen.get(k).push(p);
  }
  const dupes = [...seen.values()].filter((g) => g.length > 1);
  const dupesWithNew = dupes.filter((g) => g.some((p) => p.createdAt >= since));
  console.log(`   ${ok(dupes.length === 0)} ${dupes.length} titre(s) en double dans tout le catalogue, dont ${dupesWithNew.length} impliquant un produit créé par cet import`);
  dupes.forEach((g) => {
    const flag = g.some((p) => p.createdAt >= since) ? '🆕' : '  ';
    console.log(`   ${flag} ${g[0].title.slice(0, 75)} (x${g.length})`);
    g.forEach((p) => console.log(`          ${p.createdAt.toISOString().slice(0, 10)}  ${Number(p.price).toFixed(2)} €  /${p.slug}`));
  });
  console.log('   (🆕 = l\'un des exemplaires vient de l\'import du jour ; les autres doublons existaient déjà avant.)');

  // 7 + 8. gammes / modèles créés
  console.log('\n7. Gammes et modèles créés depuis cette date');
  const models = await prisma.model.findMany({
    where: { products: { some: { createdAt: { gte: since } } } },
    include: { productLine: { include: { brand: true } }, _count: { select: { products: true } } },
  });
  // modèles dont TOUS les produits sont récents = modèles créés par l'import
  const newModels = [];
  for (const m of models) {
    const older = await prisma.product.count({ where: { modelId: m.id, createdAt: { lt: since } } });
    if (older === 0) newModels.push(m);
  }
  console.log(`   ${newModels.length} modèle(s) créé(s) par l'import (aucun produit plus ancien) :`);
  const noModelPhoto = newModels.filter((m) => !m.imageUrl);
  newModels.slice(0, 80).forEach((m) =>
    console.log(`        ${m.productLine.brand.name} > ${m.productLine.name} > ${m.name} (${m._count.products} produit(s))${m.imageUrl ? '' : '  [sans photo]'}`)
  );
  console.log(`\n8. ${noModelPhoto.length} modèle(s) neuf(s) sans photo — à compléter dans /admin/gammes (confort, pas urgent).`);

  // gammes vides / sans modèle
  const emptyLines = await prisma.productLine.findMany({
    where: { models: { none: {} } },
    include: { brand: true },
  });
  if (emptyLines.length) {
    console.log(`\n   ⚠️  ${emptyLines.length} gamme(s) sans aucun modèle :`);
    emptyLines.forEach((l) => console.log(`        ${l.brand.name} > ${l.name}`));
  }

  console.log('\nVérification terminée (aucune modification effectuée).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
