// scripts/diagnose-apple-root-lines.js a montré que les gammes "iPhone" et "iPad" s'appellent en
// réalité "iPhones" et "iPads" (au pluriel) en base. La page /marque/apple essaie de faire
// correspondre chaque gamme réelle à sa carte d'origine (issue de l'ancien site) par slug, puis par
// nom si le slug ne suffit pas — et ce nom pluriel casse cette seconde vérification, ce qui fait
// apparaître la gamme deux fois : une carte vide "iPhones"/"iPads" (non reconnue) à côté de la vraie
// carte "iPhone"/"iPad" (retrouvée par une recherche de secours). Ce script renomme simplement ces
// deux gammes en singulier — aucun produit, modèle, ni URL n'est touché (le slug ne change pas).
//
// Usage :
//   node scripts/fix-apple-line-names.js            (aperçu, aucune écriture)
//   node scripts/fix-apple-line-names.js --apply     (applique réellement le renommage)

require('dotenv').config({ path: require('path').join(__dirname, '../.env.migration') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');

const RENAMES = [
  { slug: 'iphone', to: 'iPhone' },
  { slug: 'ipad', to: 'iPad' },
];

async function main() {
  const brand = await prisma.brand.findFirst({ where: { slug: 'apple' } });
  if (!brand) {
    console.error('❌ Marque "apple" introuvable.');
    process.exit(1);
  }

  for (const { slug, to } of RENAMES) {
    const line = await prisma.productLine.findFirst({ where: { brandId: brand.id, slug } });
    if (!line) {
      console.log(`⚠️  Gamme de slug "${slug}" introuvable — ignorée.`);
      continue;
    }
    if (line.name === to) {
      console.log(`✅ "${slug}" s'appelle déjà "${to}" — rien à faire.`);
      continue;
    }
    console.log(`"${line.name}" → "${to}" (slug "${slug}" inchangé)`);
    if (APPLY) {
      await prisma.productLine.update({ where: { id: line.id }, data: { name: to } });
    }
  }

  if (!APPLY) {
    console.log('\nAperçu uniquement — relance avec --apply pour renommer.');
  } else {
    console.log('\n✅ Renommage terminé.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
