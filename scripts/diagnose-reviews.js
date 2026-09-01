// Diagnostic en lecture seule (aucune écriture) pour retrouver le bug signalé dans l'audit : un
// avis à 1 étoile affiché avec 5 étoiles dans le bloc "98 avis". Le code d'affichage des étoiles
// (Math.round(rating) puis répétition du caractère ★) a l'air correct partout où je l'ai lu — donc
// soit le problème vient d'une note mal importée en base (le texte de l'avis est négatif mais la
// note stockée est 5), soit ce sont carrément deux avis différents mélangés visuellement. Ce
// script sort les avis Google/Facebook (table "reviews") ainsi que les avis produits (table
// "product_reviews") dont le TEXTE semble négatif mais la NOTE est haute (4 ou 5), pour repérer la
// ligne fautive sans avoir à tout relire à l'œil.
//
// Usage :
//   node scripts/diagnose-reviews.js

require('dotenv').config({ path: require('path').join(__dirname, '../.env.migration') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Mots qui trahissent presque toujours un avis négatif en français, même sans note explicite.
const NEGATIVE_WORDS = [
  'nul', 'nulle', 'mauvais', 'mauvaise', 'déçu', 'decu', 'déçue', 'decue', 'horrible',
  'arnaque', 'catastrophe', 'jamais reçu', 'jamais recu', 'ne fonctionne pas',
  'ne marche pas', 'remboursé', 'rembourse', 'à éviter', 'a eviter', 'décevant', 'decevant',
  'défectueux', 'defectueux', 'cassé', 'casse à', 'ne recommande pas', 'très déçu', 'tres decu',
  'aucun sav', 'sav inexistant', 'pire', 'honteux', 'inadmissible', 'scandaleux',
];

function looksNegative(text) {
  if (!text) return false;
  const t = text.toLowerCase();
  return NEGATIVE_WORDS.some((w) => t.includes(w));
}

async function main() {
  console.log('--- Avis entreprise (Google / Facebook) — table "reviews" ---\n');
  const companyReviews = await prisma.review.findMany({ orderBy: [{ source: 'asc' }, { order: 'asc' }] });
  console.log(`${companyReviews.length} avis au total.\n`);
  for (const r of companyReviews) {
    const flag = looksNegative(r.text) && r.rating && r.rating >= 4 ? '  ⚠️ TEXTE NÉGATIF MAIS NOTE HAUTE' : '';
    console.log(`[${r.source}] ${r.authorName} — note: ${r.rating ?? '(aucune, "recommande")'}${flag}`);
    console.log(`   "${r.text.slice(0, 150).replace(/\s+/g, ' ')}${r.text.length > 150 ? '…' : ''}"`);
    console.log();
  }

  console.log('\n--- Produits avec le plus d\'avis (table "product_reviews") ---\n');
  const topProducts = await prisma.product.findMany({
    where: { reviewCount: { gt: 0 } },
    orderBy: { reviewCount: 'desc' },
    take: 10,
    select: { id: true, title: true, slug: true, avgRating: true, reviewCount: true },
  });
  for (const p of topProducts) {
    console.log(`"${p.title}" (/produit/${p.slug}) — ${p.reviewCount} avis, moyenne affichée: ${p.avgRating}`);
  }

  console.log('\n--- Avis produits suspects (texte négatif mais note >= 4) ---\n');
  const allProductReviews = await prisma.productReview.findMany({
    select: { id: true, productId: true, authorName: true, rating: true, text: true, product: { select: { title: true, slug: true } } },
  });
  const suspects = allProductReviews.filter((r) => looksNegative(r.text) && r.rating >= 4);
  console.log(`${allProductReviews.length} avis produits au total, ${suspects.length} suspect(s) trouvé(s).\n`);
  for (const r of suspects.slice(0, 30)) {
    console.log(`[${r.rating}★] "${r.product.title}" (/produit/${r.product.slug}) — ${r.authorName}`);
    console.log(`   "${(r.text ?? '').slice(0, 150).replace(/\s+/g, ' ')}${(r.text ?? '').length > 150 ? '…' : ''}"`);
    console.log();
  }

  // Note moyenne réellement calculée vs note stockée en cache sur Product.avgRating — un écart
  // indiquerait que le cache n'a pas été recalculé après un import ou une suppression d'avis.
  console.log('\n--- Vérification du cache avgRating/reviewCount (écarts éventuels) ---\n');
  let mismatches = 0;
  for (const p of topProducts) {
    const agg = await prisma.productReview.aggregate({
      where: { productId: p.id },
      _avg: { rating: true },
      _count: { rating: true },
    });
    const realAvg = agg._avg.rating;
    const realCount = agg._count.rating;
    if (realCount !== p.reviewCount || Math.abs((realAvg ?? 0) - (p.avgRating ?? 0)) > 0.05) {
      mismatches++;
      console.log(`⚠️  "${p.title}" : cache = ${p.avgRating}★/${p.reviewCount} avis, réel = ${realAvg?.toFixed(2)}★/${realCount} avis`);
    }
  }
  if (mismatches === 0) console.log('Aucun écart trouvé sur les 10 produits les plus commentés.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
