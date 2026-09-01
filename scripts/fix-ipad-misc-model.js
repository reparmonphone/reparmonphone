// Le diagnostic (scripts/diagnose-ipad-lines.js) a montré un modèle mal nommé "IPADS" (majuscules,
// slug "ipads") dans la gamme "iPad", avec 4 vrais produits reconditionnés dedans — pas du tout des
// données corrompues, juste mal rangés au moment de leur création : ils appartiennent chacun à un
// modèle précis qui existe déjà. Ce script (1) réaffecte chacun de ces 4 produits à son bon modèle,
// puis (2) supprime le modèle "IPADS", devenu vide, pour qu'il arrête d'apparaître comme une
// catégorie fantôme sur le site.
//
// Usage :
//   node scripts/fix-ipad-misc-model.js           (aperçu, aucune écriture)
//   node scripts/fix-ipad-misc-model.js --apply    (applique réellement les changements)

require('dotenv').config({ path: require('path').join(__dirname, '../.env.migration') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');

// slug du produit -> slug du modèle correct (les deux confirmés par le diagnostic)
const REASSIGN = {
  'ipad-7-2019-32go-wifi-gris-sideral-reconditionne-grade-a': 'ipad-2019-10-2-7e-gen',
  'ipad-5-2017-32-go-wifi-gris-sideral-reconditionne-grade-a': 'ipad-2017-9-7-5e-gen',
  'ipad-5-2017-32-go-wifi-argent-reconditionne-grade-a': 'ipad-2017-9-7-5e-gen',
  'ipad-air-2-64go-wifi-gris-sideral-reconditionne-grade-a-copie': 'ipad-air-2-2014',
};

async function main() {
  const junkModel = await prisma.model.findFirst({
    where: { name: 'IPADS', productLine: { name: 'iPad', brand: { slug: 'apple' } } },
    include: { products: { select: { id: true, title: true, slug: true } } },
  });

  if (!junkModel) {
    console.log('✅ Aucun modèle "IPADS" trouvé — rien à faire (peut-être déjà corrigé).');
    return;
  }

  console.log(`Modèle "IPADS" trouvé (id: ${junkModel.id}), ${junkModel.products.length} produit(s) à réaffecter.\n`);

  for (const product of junkModel.products) {
    const targetSlug = REASSIGN[product.slug];
    if (!targetSlug) {
      console.log(`⚠️  Produit "${product.title}" (${product.slug}) : pas de correspondance connue, laissé tel quel.`);
      continue;
    }
    const targetModel = await prisma.model.findFirst({ where: { slug: targetSlug } });
    if (!targetModel) {
      console.log(`⚠️  Modèle cible "${targetSlug}" introuvable pour "${product.title}", laissé tel quel.`);
      continue;
    }
    console.log(`  "${product.title}" → modèle "${targetModel.name}"`);
    if (APPLY) {
      await prisma.product.update({ where: { id: product.id }, data: { modelId: targetModel.id } });
    }
  }

  const remaining = await prisma.model.findUnique({
    where: { id: junkModel.id },
    include: { products: { select: { id: true } } },
  });

  if (!APPLY) {
    console.log('\nAperçu uniquement — relance avec --apply pour appliquer, puis supprimer le modèle "IPADS".');
    return;
  }

  if (remaining && remaining.products.length === 0) {
    await prisma.model.delete({ where: { id: junkModel.id } });
    console.log('\n✅ Produits réaffectés, modèle "IPADS" (vide) supprimé.');
  } else {
    console.log(`\n⚠️  Modèle "IPADS" gardé : il reste ${remaining?.products.length ?? '?'} produit(s) sans correspondance connue.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
