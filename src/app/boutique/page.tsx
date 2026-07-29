import { prisma } from '@/lib/prisma';
import ProductCard from '@/components/ProductCard';
import Filters from '@/components/Filters';
import type { PieceType } from '@prisma/client';
import { getFavoriteProductIds } from '@/app/compte/favoris/actions';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.reparmonphone.fr';

type BoutiqueSearchParams = { marque?: string; gamme?: string; modele?: string; type?: string; q?: string };

export async function generateMetadata({ searchParams }: { searchParams: BoutiqueSearchParams }) {
  const hasFilters = !!(searchParams.marque || searchParams.gamme || searchParams.modele || searchParams.type || searchParams.q);

  let title = 'Boutique — Pièces détachées téléphone | ReparMonPhone';
  let description =
    'Toutes nos pièces détachées et accessoires pour smartphone : écrans, batteries, connecteurs de charge. Apple, Samsung, Huawei, Xiaomi. Livraison Chronopost 24h.';

  if (hasFilters) {
    const labelParts = [searchParams.marque, searchParams.gamme, searchParams.modele, searchParams.q].filter(Boolean);
    if (labelParts.length > 0) {
      const label = labelParts.join(' ');
      title = `${label} — Pièces détachées | ReparMonPhone`;
      description = `Découvrez nos pièces détachées et accessoires ${label} : écrans, batteries, connecteurs. Livraison Chronopost 24h partout en France.`;
    }
  }

  return {
    title,
    description,
    // Les combinaisons de filtres (marque/gamme/modèle/type/recherche) génèrent de nombreuses URLs
    // différentes qui affichent des listes de produits très proches les unes des autres. Plutôt que
    // de laisser Google indexer chaque variante comme une page à part (dilution du référencement,
    // risque de contenu dupliqué), on désigne toujours /boutique (sans paramètres) comme version
    // canonique. Les pages /marque/[...] restent les vraies pages de catégorie à indexer.
    alternates: { canonical: `${SITE_URL}/boutique` },
  };
}

export default async function BoutiquePage({
  searchParams,
}: {
  searchParams: BoutiqueSearchParams;
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

  const [products, favoriteIds] = await Promise.all([
    prisma.product.findMany({
      where,
      include: { model: { include: { productLine: { include: { brand: true } } } } },
      orderBy: { title: 'asc' },
      take: 60,
    }),
    getFavoriteProductIds(),
  ]);

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
              favorited={favoriteIds.includes(p.id)}
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
