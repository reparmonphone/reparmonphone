// Diagnostic en lecture seule (aucune écriture) : pour chacune des 4 gammes iPad (iPad, iPad Pro,
// iPad Mini, iPad Air), liste chaque modèle avec son nombre de produits — pour repérer d'un coup
// d'œil les modèles à 0 produit (ou très peu), après l'import scripts/import-ipad-products.js.
//
// Usage :
//   node scripts/diagnose-ipad-coverage.js

require('dotenv').config({ path: require('path').join(__dirname, '../.env.migration') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const brand = await prisma.brand.findFirst({ where: { slug: 'apple' } });
  if (!brand) {
    console.error('❌ Marque "apple" introuvable.');
    process.exit(1);
  }

  const lines = await prisma.productLine.findMany({
    where: { brandId: brand.id, name: { contains: 'ipad', mode: 'insensitive' } },
    include: {
      models: {
        orderBy: { sortOrder: 'asc' },
        include: { products: { select: { id: true, showInBoutique: true, inStock: true } } },
      },
    },
  });

  let totalModels = 0;
  let emptyModels = 0;
  const emptyList = [];

  for (const line of lines) {
    console.log('='.repeat(70));
    console.log(`Gamme "${line.name}" (${line.models.length} modèle(s))`);
    for (const m of line.models) {
      totalModels++;
      const total = m.products.length;
      const enStock = m.products.filter((p) => p.inStock).length;
      const enBoutique = m.products.filter((p) => p.showInBoutique).length;
      const marker = total === 0 ? '❌' : total < 3 ? '🟡' : '✅';
      console.log(`  ${marker} "${m.name}" — ${total} produit(s) (${enStock} en stock, ${enBoutique} visible(s) en boutique)`);
      if (total === 0) {
        emptyModels++;
        emptyList.push(`${line.name} > ${m.name}`);
      }
    }
    console.log('');
  }

  console.log('='.repeat(70));
  console.log(`${totalModels} modèle(s) au total, dont ${emptyModels} à 0 produit.`);
  if (emptyList.length > 0) {
    console.log('\nModèles à 0 produit :');
    for (const e of emptyList) console.log(`  - ${e}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
