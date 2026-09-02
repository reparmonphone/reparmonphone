import { prisma } from '@/lib/prisma';
import TopProduitsCarousel, { type CarouselProduct } from './TopProduitsCarousel';
import type { Prisma } from '@prisma/client';

const include = { model: { include: { productLine: { include: { brand: true } } } } } as const;

// Exclut les fiches manifestement invalides pour l'affichage vitrine : prix à 0€ (fiche
// incomplète) et titres "(Copie)" (doublons de catalogue, jamais de vrais produits à montrer).
// Même filtre que TopNouveautesSection.tsx, pour un affichage propre partout sur l'accueil.
const SHOWCASE_FILTER = {
  price: { gt: 0 },
  NOT: { title: { contains: 'copie', mode: 'insensitive' as const } },
};

function toCarouselProduct(p: {
  id: string;
  slug: string;
  title: string;
  price: unknown;
  regularPrice: unknown;
  imageUrl: string | null;
  avgRating: number | null;
  reviewCount: number;
  model: { productLine: { brand: { name: string } } };
}): CarouselProduct {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    price: Number(p.price),
    regularPrice: p.regularPrice ? Number(p.regularPrice) : null,
    imageUrl: p.imageUrl,
    avgRating: p.avgRating,
    reviewCount: p.reviewCount,
    brandName: p.model.productLine.brand.name,
  };
}

// Pioche un échantillon aléatoire parmi TOUS les produits correspondant au filtre,
// en prenant une fenêtre à un endroit aléatoire du catalogue puis en mélangeant.
// excludeIds sert à ne pas répéter, dans "Vedette", des produits déjà montrés dans "Nouveautés"
// juste au-dessus sur la même page.
async function getRandomProducts(where: Prisma.ProductWhereInput, take: number, excludeIds: string[] = []) {
  const fullWhere: Prisma.ProductWhereInput = excludeIds.length ? { ...where, id: { notIn: excludeIds } } : where;
  const total = await prisma.product.count({ where: fullWhere });
  if (total === 0) return [];

  const windowSize = Math.min(total, Math.max(take * 3, 60));
  const maxSkip = Math.max(0, total - windowSize);
  const skip = Math.floor(Math.random() * (maxSkip + 1));

  const window = await prisma.product.findMany({
    where: fullWhere,
    include,
    skip,
    take: windowSize,
    orderBy: { id: 'asc' },
  });

  return [...window].sort(() => Math.random() - 0.5).slice(0, take);
}

// Les produits réellement les plus récents (même logique de fraîcheur que le "Top Nouveautés" de
// l'accueil, voir TopNouveautesSection.tsx), pour que l'onglet "Nouveautés" de ce carrousel
// montre vraiment les derniers ajouts plutôt qu'un tirage au sort dans tout le catalogue.
async function getRecentProducts(where: Prisma.ProductWhereInput, take: number) {
  const pool = await prisma.product.findMany({
    where,
    include,
    orderBy: { createdAt: 'desc' },
    take: Math.max(take * 3, 60),
  });
  return [...pool].sort(() => Math.random() - 0.5).slice(0, take);
}

export default async function TopProduitsSection() {
  const baseWhere: Prisma.ProductWhereInput = { inStock: true, showInBoutique: true, ...SHOWCASE_FILTER };

  const nouveautes = await getRecentProducts(baseWhere, 20);
  const nouveauteIds = nouveautes.map((p) => p.id);

  // "Vedette" tire au hasard uniquement parmi les modèles cochés ⭐ depuis /admin/gammes (voir
  // Model.featuredOnHome) — pour ne plus faire remonter de vieilles pièces bon marché (iPhone 5,
  // etc.) à côté des modèles récents. Tant que Krys n'a encore rien coché nulle part, on retombe sur
  // l'ancien comportement (tirage dans tout le catalogue) pour ne jamais afficher un bloc vide.
  const featuredWhere: Prisma.ProductWhereInput = { ...baseWhere, model: { featuredOnHome: true } };
  const hasFeaturedSelection = (await prisma.product.count({ where: featuredWhere })) > 0;

  const [vedette, promos] = await Promise.all([
    getRandomProducts(hasFeaturedSelection ? featuredWhere : baseWhere, 20, nouveauteIds),
    prisma.product.findMany({
      where: { inStock: true, showInBoutique: true, ...SHOWCASE_FILTER, regularPrice: { not: null } },
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
