// Diagnostic en lecture seule (v2) : on veut savoir précisément (1) la liste complète des 15
// modèles réels de la gamme "Galaxy Note" en base, et (2) quels sont les 26 produits que la page
// publique associe à la carte fantôme "Note 10+" (via la recherche floue sur le titre/nom de
// modèle), et sous quel modèle/gamme ils sont RÉELLEMENT rangés aujourd'hui.
//
// Usage :
//   node scripts/inspect-note-10-plus-v2.js

require('dotenv').config({ path: require('path').join(__dirname, '../.env.migration') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('========== Liste complète des modèles de la ligne "Galaxy Note" ==========');
  const line = await prisma.productLine.findFirst({
    where: { name: { contains: 'Galaxy Note', mode: 'insensitive' } },
    include: {
      brand: true,
      models: { orderBy: { sortOrder: 'asc' }, include: { _count: { select: { products: true } } } },
    },
  });
  if (!line) {
    console.log('(aucune ligne "Galaxy Note" trouvée)');
  } else {
    console.log(`ProductLine id=${line.id} name="${line.name}" slug="${line.slug}" brand="${line.brand?.name}"`);
    for (const m of line.models) {
      console.log(`  - id=${m.id} name="${m.name}" slug="${m.slug}" produits=${m._count.products} sortOrder=${m.sortOrder}`);
    }
  }

  // Reproduit la recherche floue exacte utilisée par la page publique pour la carte "Note 10+" :
  // showInBoutique + brand samsung + (title contient "Note 10+" OU model.name contient "Note 10+")
  console.log('\n========== Produits "showInBoutique" correspondant à la recherche floue "Note 10+" (marque Samsung) ==========');
  const products = await prisma.product.findMany({
    where: {
      showInBoutique: true,
      model: { productLine: { brand: { slug: 'samsung' } } },
      OR: [
        { title: { contains: 'Note 10+', mode: 'insensitive' } },
        { model: { name: { contains: 'Note 10+', mode: 'insensitive' } } },
      ],
    },
    select: {
      id: true,
      title: true,
      slug: true,
      showInBoutique: true,
      model: { select: { id: true, name: true, slug: true, productLine: { select: { name: true, slug: true } } } },
    },
    orderBy: { title: 'asc' },
  });
  console.log(`Total : ${products.length} produits\n`);

  const byModel = new Map();
  for (const p of products) {
    const key = `${p.model?.productLine?.name ?? '(sans gamme)'} / ${p.model?.name ?? '(sans modèle)'}`;
    if (!byModel.has(key)) byModel.set(key, []);
    byModel.get(key).push(p);
  }
  for (const [key, list] of byModel.entries()) {
    console.log(`--- ${key} (${list.length} produits) ---`);
    for (const p of list.slice(0, 8)) {
      console.log(`    "${p.title}" (slug=${p.slug})`);
    }
    if (list.length > 8) console.log(`    ... et ${list.length - 8} autres`);
  }

  // Vérifie aussi sans la restriction showInBoutique / marque, au cas où certains produits "Note
  // 10+" existent mais sont désactivés ou mal rattachés à une autre marque.
  console.log('\n========== (contrôle) Produits dont le TITRE contient "Note 10+", toutes marques/statuts confondus ==========');
  const anyTitle = await prisma.product.findMany({
    where: { title: { contains: 'Note 10+', mode: 'insensitive' } },
    select: {
      title: true,
      showInBoutique: true,
      model: { select: { name: true, productLine: { select: { name: true, brand: { select: { name: true } } } } } },
    },
    orderBy: { title: 'asc' },
  });
  console.log(`Total : ${anyTitle.length} produits`);
  for (const p of anyTitle.slice(0, 40)) {
    console.log(`  "${p.title}" — showInBoutique=${p.showInBoutique} — modèle="${p.model?.name}" gamme="${p.model?.productLine?.name}" marque="${p.model?.productLine?.brand?.name}"`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
