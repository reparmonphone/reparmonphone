// Supprime les avis produits dont le texte est un DOUBLON EXACT d'au moins un autre avis en base
// (texte identique, caractère pour caractère) — le signe que ce ne sont pas des avis distincts
// écrits par de vrais clients différents, mais des phrases recyclées en masse (probablement
// héritées d'un import/plugin de l'ancien site WooCommerce, avis datés 2018-2019, tous non
// vérifiés). Voir scripts/check-duplicate-review-text.js pour le diagnostic qui a mené à cette
// décision : 15 phrases représentent à elles seules 83% des 8656 avis produits.
//
// Ne touche PAS :
//   - les avis dont le texte est vide/absent (juste une note sans commentaire — pas un signe de
//     fabrication, on ne supprime pas sur ce seul critère)
//   - les avis dont le texte est unique en base (aucun autre avis, produit confondu, avec le même
//     texte mot pour mot)
//
// Après suppression, recalcule avgRating/reviewCount pour chaque produit concerné, pour que les
// notes affichées sur le site restent exactes.
//
// Usage :
//   node scripts/remove-duplicate-reviews.js --dry-run
//   node scripts/remove-duplicate-reviews.js

require('dotenv').config({ path: require('path').join(__dirname, '../.env.migration') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  console.log(DRY_RUN ? '--- MODE DRY-RUN (aucune écriture) ---\n' : '--- SUPPRESSION RÉELLE ---\n');

  const totalBefore = await prisma.productReview.count();

  // Regroupe par texte exact (en ignorant les textes vides/absents), pour trouver tous les textes
  // qui apparaissent plus d'une fois — pas seulement le top 15 déjà identifié.
  const duplicateGroups = await prisma.productReview.groupBy({
    by: ['text'],
    where: { text: { not: null, notIn: [''] } },
    _count: { text: true },
    having: { text: { _count: { gt: 1 } } },
  });

  const duplicateTexts = duplicateGroups.map((g) => g.text).filter((t) => t !== null);
  const totalToDelete = duplicateGroups.reduce((s, g) => s + g._count.text, 0);

  console.log(`${duplicateTexts.length} texte(s) distinct(s) dupliqué(s), représentant ${totalToDelete} avis sur ${totalBefore} au total.\n`);

  // Les 20 textes les plus fréquents, pour vérification visuelle avant suppression.
  const sorted = [...duplicateGroups].sort((a, b) => b._count.text - a._count.text).slice(0, 20);
  console.log('--- Aperçu (20 textes les plus dupliqués) ---');
  for (const g of sorted) {
    console.log(`  ${g._count.text} avis : "${g.text.slice(0, 80)}"`);
  }

  // Produits concernés (pour recalculer leur note ensuite)
  const affectedReviews = await prisma.productReview.findMany({
    where: { text: { in: duplicateTexts } },
    select: { id: true, productId: true },
  });
  const affectedProductIds = [...new Set(affectedReviews.map((r) => r.productId))];
  console.log(`\n${affectedProductIds.length} produit(s) verront leur note moyenne recalculée.`);

  if (DRY_RUN) {
    console.log('\nDry-run terminé, aucune écriture effectuée. Relance sans --dry-run pour appliquer.');
    return;
  }

  console.log('\nSuppression en cours...');
  const deleted = await prisma.productReview.deleteMany({ where: { text: { in: duplicateTexts } } });
  console.log(`✅ ${deleted.count} avis supprimés.`);

  console.log(`\nRecalcul de la note moyenne pour ${affectedProductIds.length} produit(s)...`);
  for (const productId of affectedProductIds) {
    const agg = await prisma.productReview.aggregate({
      where: { productId },
      _avg: { rating: true },
      _count: { rating: true },
    });
    await prisma.product.update({
      where: { id: productId },
      data: { avgRating: agg._avg.rating, reviewCount: agg._count.rating },
    });
  }

  const totalAfter = await prisma.productReview.count();
  console.log(`\nTerminé. Avis produits en base : ${totalBefore} → ${totalAfter}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
