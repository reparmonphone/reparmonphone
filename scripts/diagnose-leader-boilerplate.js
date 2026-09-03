// Affiche le texte COMPLET (non tronqué) de quelques fiches produit contenant le motif "leader",
// pour voir la phrase entière avant de préparer un script de remplacement en masse.
// Lecture seule.
//
// Usage :
//   node scripts/diagnose-leader-boilerplate.js

require('dotenv').config({ path: require('path').join(__dirname, '../.env.migration') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    where: { description: { contains: 'Leader en vente', mode: 'insensitive' } },
    select: { slug: true, title: true, description: true },
    take: 3,
  });

  for (const p of products) {
    console.log(`\n========== [${p.slug}] "${p.title}" ==========`);
    console.log(p.description);
  }

  // Compte combien de produits contiennent EXACTEMENT cette formule (pour calibrer un remplacement
  // simple et sûr), vs des variantes légèrement différentes.
  const exactCount = await prisma.product.count({
    where: {
      description: {
        contains: 'Leader en vente de pièces détachées de smartphones aux particuliers et professionnels',
      },
    },
  });
  console.log(`\n\nProduits contenant EXACTEMENT cette phrase : ${exactCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
