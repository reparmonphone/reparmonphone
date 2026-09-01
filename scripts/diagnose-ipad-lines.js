// Diagnostic en lecture seule (aucune écriture) : sur /marque/apple/ipads/ipads, tous les modèles
// d'iPad (Pro, Air, Mini, standard) s'affichent en vrac dans une seule grille, au lieu d'être
// répartis dans 4 catégories (iPad / iPad Pro / iPad Mini / iPad Air) comme avant. Ce script liste :
//   1. Toutes les gammes ("ProductLine") Apple dont le nom contient "ipad" (insensible à la casse)
//      — pour voir s'il existe encore des gammes séparées "iPad Pro" / "iPad Mini" / "iPad Air",
//      ou si tout a été fusionné dans une seule gamme "iPad".
//   2. Pour la (ou les) gamme(s) trouvée(s), le détail de chaque modèle avec son nombre de produits.
//   3. Toute gamme OU modèle nommé exactement "IPADS" (tout en majuscules) — repéré comme
//      probablement corrompu lors du precedent import photos.
//
// Usage :
//   node scripts/diagnose-ipad-lines.js

require('dotenv').config({ path: require('path').join(__dirname, '../.env.migration') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const brand = await prisma.brand.findFirst({ where: { slug: 'apple' } });
  if (!brand) {
    console.error('❌ Marque "apple" introuvable en base.');
    process.exit(1);
  }

  const lines = await prisma.productLine.findMany({
    where: { brandId: brand.id, name: { contains: 'ipad', mode: 'insensitive' } },
    include: {
      models: {
        include: {
          products: { select: { id: true, title: true, slug: true, showInBoutique: true } },
        },
      },
    },
  });

  console.log(`${lines.length} gamme(s) Apple dont le nom contient "ipad" trouvée(s).\n`);

  for (const line of lines) {
    const totalProducts = line.models.reduce((s, m) => s + m.products.length, 0);
    console.log('='.repeat(70));
    console.log(`Gamme : "${line.name}"  (id: ${line.id}, slug: "${line.slug}")`);
    console.log(`  imageUrl  : ${line.imageUrl ?? '(aucune)'}`);
    console.log(`  sortOrder : ${line.sortOrder}`);
    console.log(`  ${line.models.length} modèle(s), ${totalProducts} produit(s) au total\n`);
    for (const m of line.models) {
      console.log(`  - Modèle "${m.name}" (id: ${m.id}, slug: "${m.slug}") : ${m.products.length} produit(s)`);
    }
    console.log('');
  }

  // Recherche spécifique de tout ce qui s'appelle exactement "IPADS" (gamme ou modèle),
  // repéré comme probablement corrompu.
  const junkLines = await prisma.productLine.findMany({
    where: { brandId: brand.id, name: 'IPADS' },
    include: { models: { include: { products: { select: { id: true, title: true, slug: true } } } } },
  });
  const junkModels = await prisma.model.findMany({
    where: { name: 'IPADS', productLine: { brandId: brand.id } },
    include: { products: { select: { id: true, title: true, slug: true } }, productLine: { select: { name: true, slug: true } } },
  });

  console.log('='.repeat(70));
  console.log(`Gamme(s) nommée(s) exactement "IPADS" : ${junkLines.length}`);
  for (const l of junkLines) {
    console.log(`  - id: ${l.id}, slug: "${l.slug}", ${l.models.length} modèle(s)`);
    for (const m of l.models) {
      console.log(`      • modèle "${m.name}" : ${m.products.length} produit(s)`);
      for (const p of m.products) console.log(`          - "${p.title}" (${p.slug})`);
    }
  }
  console.log(`Modèle(s) nommé(s) exactement "IPADS" : ${junkModels.length}`);
  for (const m of junkModels) {
    console.log(`  - id: ${m.id}, slug: "${m.slug}", dans la gamme "${m.productLine.name}" (${m.productLine.slug}) : ${m.products.length} produit(s)`);
    for (const p of m.products) console.log(`      - "${p.title}" (${p.slug})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
