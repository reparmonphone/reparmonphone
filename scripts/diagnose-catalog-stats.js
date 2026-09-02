// Chiffres réels du catalogue, pour remplacer ceux (probablement inventés par le thème WordPress
// d'origine — "15000+ Produits en Stock", "20+ Fournisseurs") actuellement affichés sur la page
// "À propos". Lecture seule.
//
// Usage :
//   node scripts/diagnose-catalog-stats.js

require('dotenv').config({ path: require('path').join(__dirname, '../.env.migration') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const [totalProducts, inStockProducts, brandsCount, modelsCount] = await Promise.all([
    prisma.product.count(),
    prisma.product.count({ where: { inStock: true, showInBoutique: true } }),
    prisma.brand.count(),
    prisma.model.count(),
  ]);

  console.log(`Produits au total (catalogue) : ${totalProducts}`);
  console.log(`Produits en stock, affichés en boutique : ${inStockProducts}`);
  console.log(`Marques : ${brandsCount}`);
  console.log(`Modèles (toutes marques confondues) : ${modelsCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
