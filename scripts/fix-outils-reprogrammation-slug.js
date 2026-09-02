// Le diagnostic (scripts/diagnose-outils-lines.js) a montré que la gamme "Reprogrammation" (sous la
// marque Outils) a hérité, lors de la migration WordPress, du slug "apple" au lieu de
// "reprogrammation" — un reliquat sans rapport avec la marque Apple. Résultat : l'URL
// /marque/outils/apple entre en collision avec la clé de contenu statique "apple" (celle de la page
// racine de la marque Apple, voir data/category_content.json) et affiche donc iPhone/iPad/AirPods/
// Watch au lieu de Programmation/Testeur. Ce script corrige uniquement ce slug — le nom
// "Reprogrammation", ses 2 modèles (Programmation, Testeur) et leurs produits ne sont pas touchés.
//
// Usage :
//   node scripts/fix-outils-reprogrammation-slug.js            (aperçu, aucune écriture)
//   node scripts/fix-outils-reprogrammation-slug.js --apply     (applique réellement le changement)

require('dotenv').config({ path: require('path').join(__dirname, '../.env.migration') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');
const NEW_SLUG = 'reprogrammation';

async function main() {
  const brand = await prisma.brand.findFirst({ where: { slug: 'outils' } });
  if (!brand) {
    console.error('❌ Marque "outils" introuvable.');
    process.exit(1);
  }

  const line = await prisma.productLine.findFirst({ where: { brandId: brand.id, name: 'Reprogrammation' } });
  if (!line) {
    console.error('❌ Gamme "Reprogrammation" introuvable sous Outils.');
    process.exit(1);
  }

  if (line.slug === NEW_SLUG) {
    console.log(`✅ Le slug est déjà "${NEW_SLUG}" — rien à faire.`);
    return;
  }

  const collision = await prisma.productLine.findFirst({ where: { brandId: brand.id, slug: NEW_SLUG } });
  if (collision) {
    console.error(`❌ Une autre gamme utilise déjà le slug "${NEW_SLUG}" sous Outils — abandon par sécurité.`);
    process.exit(1);
  }

  console.log(`Gamme "Reprogrammation" : slug "${line.slug}" → "${NEW_SLUG}"`);
  console.log(`(nouvelle URL publique : /marque/outils/${NEW_SLUG})`);

  if (APPLY) {
    await prisma.productLine.update({ where: { id: line.id }, data: { slug: NEW_SLUG } });
    console.log('\n✅ Slug mis à jour.');
  } else {
    console.log('\nAperçu uniquement — relance avec --apply pour appliquer.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
