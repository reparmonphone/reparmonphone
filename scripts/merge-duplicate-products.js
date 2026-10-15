/**
 * Nettoie les produits en DOUBLE (même titre, même modèle, même prix) SANS RIEN SUPPRIMER :
 *   - garde la meilleure fiche de chaque groupe (celle qui a des commandes / favoris / avis, sinon celle
 *     qui a une photo, sinon la plus ancienne dont le slug n'est pas "-2" / "-copie")
 *   - masque les autres de la boutique (showInBoutique = false) — elles disparaissent de la boutique,
 *     du sitemap, des pages "pièces détachées" et du flux produits
 *   - enregistre une redirection 301 /produit/<doublon> -> /produit/<gardé> (table Redirect, visible
 *     dans /admin/seo) ; la fiche produit applique cette redirection (patch de src/app/produit/[slug]/page.tsx)
 *
 * Les groupes à titre identique mais prix OU modèle différent sont seulement LISTÉS (variantes possibles),
 * jamais modifiés. Tu peux supprimer toi-même les fiches masquées plus tard depuis /admin/produits.
 *
 * Usage :
 *   node scripts/merge-duplicate-products.js           (aperçu, rien n'est écrit)
 *   node scripts/merge-duplicate-products.js --apply   (applique)
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.migration') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

// Le "+" compte (iPhone 8+ != iPhone 8) : on le garde sous la forme "plus".
const norm = (s) => (s || '').replace(/\+/g, ' plus ').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '');
// Comparaison stricte : seuls des titres identiques (espaces/casse près, accents et "+" conservés) sont fusionnés.
const strict = (s) => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
const ugly = (slug) => (/-\d+$/.test(slug) || /-copie/.test(slug) ? 1 : 0);

async function main() {
  console.log(APPLY ? 'MODE RÉEL — la base va être modifiée (rien n\'est supprimé).\n' : 'MODE APERÇU — rien ne sera écrit.\n');
  const products = await prisma.product.findMany({
    select: {
      id: true, title: true, slug: true, price: true, modelId: true, imageUrl: true, createdAt: true, showInBoutique: true,
      model: { select: { name: true, productLine: { select: { name: true, brand: { select: { name: true } } } } } },
      _count: { select: { orderItems: true, favorites: true, reviews: true, stockNotifications: true } },
    },
  });
  const groups = new Map();
  for (const p of products) {
    const k = norm(p.title);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(p);
  }
  const dupGroups = [...groups.values()].filter((g) => g.length > 1);
  console.log(`${dupGroups.length} titre(s) en double.\n`);

  const toMerge = [];
  const toReview = [];
  for (const g of dupGroups) {
    const same = g.every((p) => p.modelId === g[0].modelId && Number(p.price) === Number(g[0].price) && strict(p.title) === strict(g[0].title));
    if (!same) { toReview.push(g); continue; }
    const score = (p) => p._count.orderItems * 1000 + p._count.reviews * 100 + p._count.favorites * 10 + p._count.stockNotifications + (p.imageUrl ? 5 : 0) + (p.showInBoutique ? 3 : 0);
    const sorted = [...g].sort((a, b) => score(b) - score(a) || ugly(a.slug) - ugly(b.slug) || a.createdAt - b.createdAt);
    toMerge.push({ keep: sorted[0], drop: sorted.slice(1) });
  }

  console.log(`${toMerge.length} groupe(s) fusionnables (même modèle, même prix) :`);
  for (const m of toMerge) {
    console.log(`   GARDE  /${m.keep.slug}  (commandes ${m.keep._count.orderItems}, favoris ${m.keep._count.favorites}, avis ${m.keep._count.reviews})`);
    m.drop.forEach((d) => console.log(`   MASQUE /${d.slug}  (commandes ${d._count.orderItems}, favoris ${d._count.favorites}, avis ${d._count.reviews})`));
  }
  if (toReview.length) {
    console.log(`\n${toReview.length} groupe(s) à titre identique mais prix, modèle ou texte différent — NON TOUCHÉS (variantes ?) :`);
    toReview.forEach((g) => {
      console.log(`   ${g[0].title.slice(0, 80)}`);
      g.forEach((p) => console.log(`        ${Number(p.price).toFixed(2)} €  ${p.model.productLine.brand.name} > ${p.model.productLine.name} > ${p.model.name}${strict(p.title) !== strict(g[0].title) ? '  [titre : ' + p.title.slice(0, 60) + ']' : ''}  /${p.slug}`));
    });
  }

  if (!APPLY) {
    console.log('\nAperçu uniquement — relance avec --apply pour masquer les doublons et enregistrer les redirections.');
    return;
  }
  let hidden = 0;
  for (const m of toMerge) {
    for (const d of m.drop) {
      await prisma.product.update({ where: { id: d.id }, data: { showInBoutique: false } });
      const fromPath = `/produit/${d.slug}`;
      const toPath = `/produit/${m.keep.slug}`;
      await prisma.redirect.upsert({
        where: { fromPath },
        update: { toPath, statusCode: 301 },
        create: { fromPath, toPath, statusCode: 301 },
      });
      hidden++;
    }
  }
  console.log(`\n✅ ${hidden} doublon(s) masqué(s) de la boutique, avec redirection 301 vers la fiche conservée.`);
  console.log('   Rien n\'a été supprimé : tu peux effacer les fiches masquées depuis /admin/produits si tu le souhaites.');
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
