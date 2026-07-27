import { prisma } from '@/lib/prisma';
import ProductCard from '@/components/ProductCard';
import Filters from '@/components/Filters';
import type { PieceType } from '@prisma/client';

export const metadata = { title: 'Boutique — Pièces détachées | ReparMonPhone' };

export default async function BoutiquePage({
  searchParams,
}: {
  searchParams: { marque?: string; gamme?: string; modele?: string; type?: string; q?: string };
}) {
  const [brands, lines, models] = await Promise.all([
    prisma.brand.findMany({ orderBy: { name: 'asc' } }),
    prisma.productLine.findMany({ orderBy: { name: 'asc' } }),
    prisma.model.findMany({ orderBy: { name: 'asc' } }),
  ]);

  const where: Record<string, unknown> = { showInBoutique: true };
  const modelFilter: Record<string, unknown> = {};

  if (searchParams.modele) {
    modelFilter.slug = searchParams.modele;
  }
  if (searchParams.gamme) {
    modelFilter.productLine = { slug: searchParams.gamme };
  }
  if (searchParams.marque) {
    modelFilter.productLine = {
      ...(modelFilter.productLine as object),
      brand: { slug: searchParams.marque },
    };
  }
  if (Object.keys(modelFilter).length > 0) {
    where.model = modelFilter;
  }
  if (searchParams.type) {
    where.pieceType = searchParams.type as PieceType;
  }
  if (searchParams.q) {
    where.OR = [
      { title: { contains: searchParams.q, mode: 'insensitive' } },
      { model: { name: { contains: searchParams.q, mode: 'insensitive' } } },
    ];
  }

  const products = await prisma.product.findMany({
    where,
    include: { model: { include: { productLine: { include: { brand: true } } } } },
    orderBy: { title: 'asc' },
    take: 60,
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-6">
        {searchParams.q ? `Résultats pour "${searchParams.q}"` : 'Boutique — Pièces détachées'}
      </h1>
      <Filters brands={brands} lines={lines} models={models} />

      {products.length === 0 ? (
        <p className="text-gray-500">Aucune pièce ne correspond à ces filtres.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {products.map((p) => (
            <ProductCard
              key={p.id}
              product={{
                id: p.id,
                slug: p.slug,
                title: p.title,
                price: Number(p.price),
                imageUrl: p.imageUrl,
                inStock: p.inStock,
                brandName: p.model.productLine.brand.name,
                modelName: p.model.name,
                avgRating: p.avgRating,
                reviewCount: p.reviewCount,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
