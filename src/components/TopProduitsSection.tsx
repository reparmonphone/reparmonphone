import { prisma } from '@/lib/prisma';
import TopProduitsCarousel, { type CarouselProduct } from './TopProduitsCarousel';
import type { Prisma } from '@prisma/client';

const include = { model: { include: { productLine: { include: { brand: true } } } } } as const;

function toCarouselProduct(p: {
  id: string;
  slug: string;
  title: string;
  price: unknown;
  regularPrice: unknown;
  imageUrl: string | null;
  model: { productLine: { brand: { name: string } } };
}): CarouselProduct {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    price: Number(p.price),
    regularPrice: p.regularPrice ? Number(p.regularPrice) : null,
    imageUrl: p.imageUrl,
    brandName: p.model.productLine.brand.name,
  };
}

// Pioche un échantillon aléatoire parmi TOUS les produits correspondant au filtre,
// en prenant une fenêtre à un endroit aléatoire du catalogue puis en mélangeant.
async function getRandomProducts(where: Prisma.ProductWhereInput, take: number) {
  const total = await prisma.product.count({ where });
  if (total === 0) return [];

  const windowSize = Math.min(total, Math.max(take * 3, 60));
  const maxSkip = Math.max(0, total - windowSize);
  const skip = Math.floor(Math.random() * (maxSkip + 1));

  const window = await prisma.product.findMany({
    where,
    include,
    skip,
    take: windowSize,
    orderBy: { id: 'asc' },
  });

  return [...window].sort(() => Math.random() - 0.5).slice(0, take);
}

export default async function TopProduitsSection() {
  const [nouveautes, vedette, promos] = await Promise.all([
    getRandomProducts({ inStock: true }, 20),
    getRandomProducts({ inStock: true }, 20),
    prisma.product.findMany({
      where: { inStock: true, regularPrice: { not: null } },
      take: 40,
      include,
    }),
  ]);

  // Les "offres spéciales" sont les produits dont le prix affiché est inférieur au prix barré
  const promosFiltered = [...promos]
    .filter((p) => p.regularPrice && Number(p.regularPrice) > Number(p.price))
    .sort(() => Math.random() - 0.5)
    .slice(0, 20);

  return (
    <TopProduitsCarousel
      nouveautes={nouveautes.map(toCarouselProduct)}
      vedette={vedette.map(toCarouselProduct)}
      promos={promosFiltered.map(toCarouselProduct)}
    />
  );
}
