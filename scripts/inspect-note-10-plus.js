// Diagnostic en lecture seule : Krys constate que "Note 10+" apparaît bien sur la page publique
// /marque/samsung/galaxy-note (avec 26 produits), mais n'apparaît PAS dans la liste des modèles de la
// gamme "Galaxy Note" dans l'admin (qui n'en affiche que 15). On regarde où est réellement rangé ce
// modèle en base : quelle gamme (ProductLine), quelle marque (Brand), et s'il y a plusieurs lignes
// "Galaxy Note" en doublon.
//
// Usage :
//   node scripts/inspect-note-10-plus.js

require('dotenv').config({ path: require('path').join(__dirname, '../.env.migration') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 1) Tous les modèles dont le nom contient "10+" ou "10 +" (insensible à la casse), avec leur gamme/marque.
  console.log('========== Modèles correspondant à "Note 10+" ==========');
  const models = await prisma.model.findMany({
    where: { name: { contains: '10+', mode: 'insensitive' } },
    include: {
      productLine: { include: { brand: true } },
      _count: { select: { products: true } },
    },
  });
  for (const m of models) {
    console.log(
      `Model id=${m.id} name="${m.name}" sortOrder=${m.sortOrder} produits=${m._count.products} ` +
        `→ ProductLine id=${m.productLineId} name="${m.productLine?.name}" ` +
        `→ Brand="${m.productLine?.brand?.name}"`
    );
  }
  if (models.length === 0) console.log('(aucun modèle trouvé avec "10+" dans le nom)');

  // 2) Toutes les ProductLine nommées "Galaxy Note" (insensible à la casse) — pour détecter un doublon.
  console.log('\n========== ProductLine "Galaxy Note" (recherche de doublons) ==========');
  const lines = await prisma.productLine.findMany({
    where: { name: { contains: 'Galaxy Note', mode: 'insensitive' } },
    include: { brand: true, _count: { select: { models: true } } },
  });
  for (const l of lines) {
    console.log(`ProductLine id=${l.id} name="${l.name}" slug="${l.slug}" brand="${l.brand?.name}" nbModeles=${l._count.models}`);
  }

  // 3) Détail des modèles de CHAQUE ligne "Galaxy Note" trouvée (pour voir si Note 10+ est dans une
  // ligne différente de celle affichée dans l'admin).
  for (const l of lines) {
    const modelsInLine = await prisma.model.findMany({
      where: { productLineId: l.id },
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { products: true } } },
    });
    console.log(`\n--- Modèles dans ProductLine "${l.name}" (id=${l.id}) : ${modelsInLine.length} ---`);
    for (const m of modelsInLine) {
      console.log(`  - ${m.name} (${m._count.products} produits) sortOrder=${m.sortOrder}`);
    }
  }

  // 4) D'où viennent les 26 produits affichés sur la page publique pour "Note 10+" ? On les cherche par
  // leur modèle (nom) sans présupposer la ligne, pour voir sous quelle marque/gamme ils sont rattachés.
  console.log('\n========== Produits dont le modèle est nommé "Note 10+" ==========');
  const products = await prisma.product.findMany({
    where: { model: { name: { contains: '10+', mode: 'insensitive' } } },
    select: {
      title: true,
      slug: true,
      model: { select: { name: true, productLine: { select: { name: true, brand: { select: { name: true } } } } } },
    },
    take: 5,
  });
  for (const p of products) {
    console.log(`  ${p.title} — modèle="${p.model?.name}" gamme="${p.model?.productLine?.name}" marque="${p.model?.productLine?.brand?.name}"`);
  }
  const totalCount = await prisma.product.count({ where: { model: { name: { contains: '10+', mode: 'insensitive' } } } });
  console.log(`  ... total : ${totalCount} produits`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
