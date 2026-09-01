// Diagnostic en lecture seule (aucune écriture) : sur /marque/apple, deux cartes "Watch" s'affichent
// côte à côte — une avec le bon logo Apple Watch (36 produits), une autre avec une icône générique
// cassée (36 produits aussi). Ça ressemble à deux gammes ("ProductLine") en base sous la marque
// Apple qui portent toutes les deux un nom de type "Watch", au lieu d'une seule. Ce script liste
// toutes les gammes Apple dont le nom contient "watch" (insensible à la casse), avec pour chacune :
// son slug, son imageUrl, et le détail de ses modèles + nombre de produits réels par modèle — pour
// voir s'il s'agit d'un vrai doublon (mêmes produits, juste catalogués deux fois) ou de deux gammes
// avec des produits différents (auquel cas il faudrait fusionner, pas juste supprimer).
//
// Usage :
//   node scripts/diagnose-apple-watch-lines.js

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
    where: { brandId: brand.id, name: { contains: 'watch', mode: 'insensitive' } },
    include: {
      models: {
        include: {
          products: { select: { id: true, title: true, slug: true, showInBoutique: true } },
        },
      },
    },
  });

  console.log(`${lines.length} gamme(s) Apple dont le nom contient "watch" trouvée(s).\n`);

  for (const line of lines) {
    const totalProducts = line.models.reduce((s, m) => s + m.products.length, 0);
    console.log('='.repeat(70));
    console.log(`Gamme : "${line.name}"  (id: ${line.id}, slug: "${line.slug}")`);
    console.log(`  imageUrl  : ${line.imageUrl ?? '(aucune)'}`);
    console.log(`  sortOrder : ${line.sortOrder}`);
    console.log(`  ${line.models.length} modèle(s), ${totalProducts} produit(s) au total\n`);
    for (const m of line.models) {
      console.log(`  - Modèle "${m.name}" (id: ${m.id}, slug: "${m.slug}") : ${m.products.length} produit(s)`);
      for (const p of m.products.slice(0, 5)) {
        console.log(`      • [${p.showInBoutique ? 'visible' : 'masqué'}] "${p.title}" (${p.slug}) — id: ${p.id}`);
      }
      if (m.products.length > 5) console.log(`      … et ${m.products.length - 5} autre(s)`);
    }
    console.log('');
  }

  if (lines.length === 2) {
    const [a, b] = lines;
    const aSlugs = new Set(a.models.flatMap((m) => m.products.map((p) => p.slug)));
    const bSlugs = new Set(b.models.flatMap((m) => m.products.map((p) => p.slug)));
    const overlap = [...aSlugs].filter((s) => bSlugs.has(s));
    console.log('='.repeat(70));
    console.log(`Produits en commun (même slug) entre les deux gammes : ${overlap.length}`);
    console.log(`Produits uniquement dans "${a.name}" : ${aSlugs.size - overlap.length}`);
    console.log(`Produits uniquement dans "${b.name}" : ${bSlugs.size - overlap.length}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
