// Diagnostic en lecture seule : le précédent script a fait remonter beaucoup d'avis produits avec
// EXACTEMENT le même texte ("De loin le meilleur produit du marché, vous ne serez pas déçu.") sur
// des dizaines de produits différents, signés par des noms différents. Ça ressemble à des avis
// générés automatiquement (texte template) plutôt qu'à de vrais avis clients distincts. Ce script
// mesure l'ampleur : quels textes reviennent le plus souvent, et sur combien de produits/avis au
// total, avant d'en tirer une conclusion.
//
// Usage :
//   node scripts/check-duplicate-review-text.js

require('dotenv').config({ path: require('path').join(__dirname, '../.env.migration') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const total = await prisma.productReview.count();
  console.log(`Total avis produits en base : ${total}\n`);

  const grouped = await prisma.productReview.groupBy({
    by: ['text'],
    _count: { text: true },
    orderBy: { _count: { text: 'desc' } },
    take: 15,
  });

  console.log('--- Textes d\'avis les plus répétés (top 15) ---\n');
  for (const g of grouped) {
    const pct = ((g._count.text / total) * 100).toFixed(1);
    console.log(`${g._count.text} avis (${pct}%) : "${(g.text ?? '(vide)').slice(0, 100)}"`);
  }

  const topTextCount = grouped[0]?._count.text ?? 0;
  const sumTop15 = grouped.reduce((s, g) => s + g._count.text, 0);
  console.log(`\nLes 15 textes les plus fréquents représentent à eux seuls ${sumTop15} avis sur ${total} (${((sumTop15 / total) * 100).toFixed(1)}%).`);

  // Un avis "verified: true" veut normalement dire achat + livraison confirmés (voir /avis-verifies).
  // Si les avis au texte dupliqué sont tous "verified: false", ça confirme un import en masse plutôt
  // que de vrais achats vérifiés individuellement.
  const sample = await prisma.productReview.findMany({
    where: { text: grouped[0]?.text ?? '' },
    select: { authorName: true, verified: true, createdAt: true, rating: true },
    take: 5,
  });
  console.log('\n--- Échantillon du texte le plus répété ---');
  sample.forEach((s) => console.log(`  ${s.authorName} — ${s.rating}★ — vérifié: ${s.verified} — créé le ${s.createdAt.toISOString().slice(0, 10)}`));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
