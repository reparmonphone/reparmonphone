import { prisma } from '@/lib/prisma';
import RelatedProductsCarousel from './RelatedProductsCarousel';

export default async function RelatedProducts({ modelId, excludeProductId }: { modelId: string; excludeProductId: string }) {
  const products = await prisma.product.findMany({
    where: { modelId, id: { not: excludeProductId }, showInBoutique: true },
    orderBy: { title: 'asc' },
    take: 20,
  });

  if (products.length === 0) return null;

  return (
    <div className="mt-12 pt-10 border-t border-gray-200">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Produits connexes</h2>
      <RelatedProductsCarousel
        products={products.map((p) => ({
          id: p.id,
          slug: p.slug,
          title: p.title,
          price: Number(p.price),
          imageUrl: p.imageUrl,
          inStock: p.inStock,
          avgRating: p.avgRating,
          reviewCount: p.reviewCount,
        }))}
      />
    </div>
  );
}
