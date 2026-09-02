// Même correction que scripts/fix-outils-reprogrammation-slug.js, pour l'autre gamme de la marque
// Outils : "Accessoires" a hérité du slug "autres" à la migration, d'où l'URL peu naturelle
// /marque/outils/autres. Contrairement à "apple" (slug de "Reprogrammation"), "autres" n'entre en
// collision avec aucune clé de data/category_content.json — la page fonctionnait donc déjà
// correctement, mais Krys préfère une URL cohérente : /marque/outils/accessoires. Ce script ne
// touche que ce slug — le nom "Accessoires", ses 10 modèles et leurs produits ne sont pas modifiés.
//
// Usage :
//   node scripts/fix-outils-accessoires-slug.js            (aperçu, aucune écriture)
//   node scripts/fix-outils-accessoires-slug.js --apply     (applique réellement le changement)

require('dotenv').config({ path: require('path').join(__dirname, '../.env.migration') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');
const NEW_SLUG = 'accessoires';

async function main() {
  const brand = await prisma.brand.findFirst({ where: { slug: 'outils' } });
  if (!brand) {
    console.error('❌ Marque "outils" introuvable.');
    process.exit(1);
  }

  const line = await prisma.productLine.findFirst({ where: { brandId: brand.id, name: 'Accessoires' } });
  if (!line) {
    console.error('❌ Gamme "Accessoires" introuvable sous Outils.');
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

  console.log(`Gamme "Accessoires" : slug "${line.slug}" → "${NEW_SLUG}"`);
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
