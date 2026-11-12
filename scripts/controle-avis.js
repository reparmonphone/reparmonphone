// Contrôle en LECTURE SEULE (aucune écriture en base) : tous les avis enregistrés sont-ils bien affichés sur le site ?
//
// Ce que le site affiche réellement :
//  - Avis produits (table "product_reviews") : la fiche produit affiche les 30 avis les plus récents du produit,
//    sans aucune modération ni filtre. Un avis peut donc ne pas être vu seulement si son produit n'existe plus,
//    si le produit est masqué de la boutique, ou s'il dépasse les 30 avis du produit.
//  - Avis entreprise Google / Facebook (table "reviews") : tous sont lus par la section « Avis » de l'accueil.
//
// Usage :   node scripts/controle-avis.js

require('dotenv').config({ path: require('path').join(__dirname, '../.env.migration') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const MAX_PAR_PRODUIT = 30; // même valeur que ProductReviewsSection.tsx (take: 30)

async function main() {
  // ---------- Avis produits ----------
  const avis = await prisma.productReview.findMany({
    orderBy: { createdAt: 'desc' },
    include: { product: { select: { id: true, title: true, slug: true, showInBoutique: true, inStock: true, reviewCount: true, avgRating: true } } },
  });
  console.log(`\n=== AVIS PRODUITS (table product_reviews) : ${avis.length} avis en base ===\n`);

  const parProduit = new Map();
  for (const r of avis) {
    if (!parProduit.has(r.productId)) parProduit.set(r.productId, []);
    parProduit.get(r.productId).push(r);
  }

  let nonAffiches = 0;
  for (const r of avis) {
    const liste = parProduit.get(r.productId);
    const rang = liste.indexOf(r) + 1; // 1 = le plus récent du produit
    const problemes = [];
    if (!r.product) problemes.push('produit introuvable');
    else {
      if (!r.product.showInBoutique) problemes.push('produit masqué de la boutique (fiche visible seulement par lien direct)');
      if (rang > MAX_PAR_PRODUIT) problemes.push(`au-delà des ${MAX_PAR_PRODUIT} avis affichés (rang ${rang})`);
    }
    if (problemes.length) nonAffiches++;
    const date = r.createdAt.toISOString().slice(0, 10);
    console.log(
      `${problemes.length ? '⚠️ ' : '✅'} ${date} — ${r.authorName} — ${r.rating}★${r.verified ? ' (achat vérifié)' : ''} — ${r.product ? r.product.title : '?'}`
    );
    if (r.text) console.log(`      "${r.text.slice(0, 120).replace(/\s+/g, ' ')}${r.text.length > 120 ? '…' : ''}"`);
    if (r.product) console.log(`      → https://www.reparmonphone.fr/produit/${r.product.slug}`);
    for (const p of problemes) console.log(`      ⚠️ ${p}`);
  }

  // Cohérence du compteur « N avis » / note moyenne affichés sous le titre du produit
  console.log('\n--- Compteurs « N avis » des fiches produits ---\n');
  let ecarts = 0;
  for (const [productId, liste] of parProduit) {
    const p = liste[0].product;
    if (!p) continue;
    const moyenne = liste.reduce((s, x) => s + x.rating, 0) / liste.length;
    if (p.reviewCount !== liste.length || Math.abs((p.avgRating ?? 0) - moyenne) > 0.05) {
      ecarts++;
      console.log(`⚠️ "${p.title}" : la fiche annonce ${p.avgRating?.toFixed(2) ?? '—'}★ / ${p.reviewCount} avis, la base en contient ${liste.length} (${moyenne.toFixed(2)}★)`);
    }
  }
  if (!ecarts) console.log('Aucun écart : tous les compteurs correspondent aux avis en base.');

  // Produits dont le compteur annonce des avis qui n'existent pas en base
  const produitsAvecCompteur = await prisma.product.findMany({
    where: { reviewCount: { gt: 0 } },
    select: { id: true, title: true, slug: true, reviewCount: true },
  });
  for (const p of produitsAvecCompteur) {
    if (!parProduit.has(p.id)) console.log(`⚠️ "${p.title}" annonce ${p.reviewCount} avis mais la base n'en contient aucun (compteur périmé).`);
  }

  // ---------- Avis entreprise ----------
  const entreprise = await prisma.review.findMany({ orderBy: [{ source: 'asc' }, { order: 'asc' }] });
  console.log(`\n=== AVIS ENTREPRISE (table reviews) : ${entreprise.length} avis ===`);
  const parSource = {};
  for (const r of entreprise) parSource[r.source] = (parSource[r.source] ?? 0) + 1;
  console.log(parSource);

  console.log('\n=== RÉSUMÉ ===');
  console.log(`Avis produits en base : ${avis.length} — dont ${nonAffiches} potentiellement non affiché(s).`);
  console.log(`Avis entreprise en base : ${entreprise.length} (tous lus par la section Avis de l'accueil).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
