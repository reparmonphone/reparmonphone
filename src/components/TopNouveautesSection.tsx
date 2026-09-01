import { prisma } from '@/lib/prisma';
import NouveautesCarousel, { type NouveauteProduct } from './NouveautesCarousel';

// Exclut les fiches manifestement invalides pour l'affichage vitrine : prix à 0€ (fiche
// incomplète, jamais un vrai prix de vente — vu en base sur quelques fiches connecteur de
// charge) et titres "(Copie)" (doublons laissés par un copier-coller côté catalogue, jamais de
// vrais produits à montrer aux clients).
const SHOWCASE_WHERE = {
  inStock: true,
  showInBoutique: true,
  price: { gt: 0 },
  NOT: { title: { contains: 'copie', mode: 'insensitive' as const } },
};

export default async function TopNouveautesSection() {
  const total = await prisma.product.count({ where: SHOWCASE_WHERE });
  if (total === 0) return null;

  // "Nouveautés" doit refléter les produits réellement les plus récents du catalogue — pas un
  // tirage au sort dans TOUT le catalogue (l'ancien comportement), qui pouvait tout aussi bien
  // présenter comme "nouveauté" un écran d'iPhone 3G vieux de 15 ans. On prend donc une fenêtre
  // parmi les produits les plus récemment ajoutés (assez large pour varier l'affichage d'un
  // chargement à l'autre), puis on mélange cette fenêtre.
  const RECENT_POOL_SIZE = 300;
  const pool = await prisma.product.findMany({
    where: SHOWCASE_WHERE,
    orderBy: { createdAt: 'desc' },
    take: Math.min(total, RECENT_POOL_SIZE),
  });

  const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, 20);

  if (shuffled.length === 0) return null;

  const products: NouveauteProduct[] = shuffled.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    price: Number(p.price),
    imageUrl: p.imageUrl,
    avgRating: p.avgRating,
    reviewCount: p.reviewCount,
  }));

  return (
    <section className="max-w-6xl mx-auto px-4 py-12">
      <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900">Top Nouveautés</h2>
      <p className="text-gray-500 mt-1 mb-8">Parcourez la collection de nos produits les plus récents.</p>

      <NouveautesCarousel products={products} />
    </section>
  );
}
