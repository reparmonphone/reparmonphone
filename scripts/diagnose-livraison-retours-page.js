// Diagnostic en lecture seule (aucune écriture) : dump du contenu actuel de la page DB-driven
// "Livraison & Retours" (slug "livraison-retours"), avant de la retravailler suite au retour
// d'audit SEO externe (page trop centrée sur les retours, pas assez sur la livraison Chronopost 24h).
//
// Usage :
//   node scripts/diagnose-livraison-retours-page.js

require('dotenv').config({ path: require('path').join(__dirname, '../.env.migration') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const page = await prisma.page.findUnique({ where: { slug: 'livraison-retours' } });
  if (!page) {
    console.log('❌ Aucune page avec le slug "livraison-retours" trouvée.');
    return;
  }
  console.log('Titre  :', page.title);
  console.log('Slug   :', page.slug);
  console.log('Mis à jour :', page.updatedAt);
  console.log('\n--- contentHtml ---\n');
  console.log(page.contentHtml);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
