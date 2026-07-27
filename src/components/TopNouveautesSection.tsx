import { prisma } from '@/lib/prisma';
import NouveautesCarousel, { type NouveauteProduct } from './NouveautesCarousel';

export default async function TopNouveautesSection() {
  const total = await prisma.product.count({ where: { inStock: true, showInBoutique: true } });
  if (total === 0) return null;

  // Fenêtre aléatoire dans tout le catalogue, puis mélange — change à chaque chargement de page
  const windowSize = Math.min(total, 80);
  const maxSkip = Math.max(0, total - windowSize);
  const skip = Math.floor(Math.random() * (maxSkip + 1));

  const pool = await prisma.product.findMany({
    where: { inStock: true, showInBoutique: true },
    orderBy: { id: 'asc' },
    skip,
    take: windowSize,
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
