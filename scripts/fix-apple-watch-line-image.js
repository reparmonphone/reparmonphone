// Corrige le doublon visuel repéré sur /marque/apple : deux cartes "Watch" s'affichaient côte à
// côte, une venant d'un ancien contenu figé pointant vers une URL morte de l'ancien site
// (reparmonphone.fr/watch/, retirée de data/category_content.json dans le même chantier), l'autre
// étant la VRAIE gamme "Apple Watch" en base (36 produits réels) mais sans image propre définie
// (elle retombait donc sur la photo d'un produit au hasard). Ce script donne à cette vraie gamme
// le même logo Apple Watch que celui utilisé par la carte retirée — déjà hébergé sur le Supabase de
// l'utilisateur, donc rien à télécharger/uploader.
//
// Usage :
//   node scripts/fix-apple-watch-line-image.js --dry-run
//   node scripts/fix-apple-watch-line-image.js

require('dotenv').config({ path: require('path').join(__dirname, '../.env.migration') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes('--dry-run');
const LOGO_URL = 'https://bjfmbrexkkpgwufdqkoy.supabase.co/storage/v1/object/public/products/2025/02/apple-watch.png';

async function main() {
  const line = await prisma.productLine.findFirst({ where: { slug: 'apple-watch' } });
  if (!line) {
    console.error('❌ Gamme "apple-watch" introuvable en base.');
    process.exit(1);
  }

  console.log(`Gamme trouvée : "${line.name}" (id: ${line.id})`);
  console.log(`  imageUrl actuelle : ${line.imageUrl ?? '(aucune)'}`);
  console.log(`  imageUrl cible    : ${LOGO_URL}`);

  if (DRY_RUN) {
    console.log('\nDry-run terminé, aucune écriture effectuée. Relance sans --dry-run pour appliquer.');
    return;
  }

  await prisma.productLine.update({ where: { id: line.id }, data: { imageUrl: LOGO_URL } });
  console.log('\n✅ Image mise à jour.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
