/**
 * Remplit automatiquement la meta description SEO de tous les produits qui n'en ont pas encore.
 * Ne touche jamais un produit dont la meta description a déjà été renseignée (manuellement ou
 * lors d'une exécution précédente) — sûr à relancer autant de fois que nécessaire.
 *
 * Usage : npm run backfill-seo
 */
import { PrismaClient } from '@prisma/client';
import { generateMetaDescription } from '../src/lib/seoDescription';

const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    where: { OR: [{ metaDescription: null }, { metaDescription: '' }] },
    include: { model: { include: { productLine: { include: { brand: true } } } } },
  });

  console.log(`${products.length} produit(s) sans meta description trouvé(s).`);

  let count = 0;
  for (const p of products) {
    const metaDescription = generateMetaDescription({
      title: p.title,
      brandName: p.model.productLine.brand.name,
      modelName: p.model.name,
      condition: p.condition,
      quality: p.quality,
      price: Number(p.price),
    });

    await prisma.product.update({ where: { id: p.id }, data: { metaDescription } });
    count++;
    if (count % 200 === 0) console.log(`  ...${count} produits mis à jour`);
  }

  console.log(`✅ ${count} meta descriptions générées.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
