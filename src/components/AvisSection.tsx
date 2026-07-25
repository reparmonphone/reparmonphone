import { prisma } from '@/lib/prisma';
import AvisCarousel from './AvisCarousel';

export default async function AvisSection() {
  const reviews = await prisma.review.findMany({ orderBy: [{ source: 'asc' }, { order: 'asc' }] });

  const google = reviews.filter((r) => r.source === 'GOOGLE');
  const facebook = reviews.filter((r) => r.source === 'FACEBOOK');

  if (google.length === 0 && facebook.length === 0) return null;

  return (
    <section className="max-w-6xl mx-auto px-4 py-12">
      <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 flex items-center gap-2">
        💬 Ce Que Nos Clients Disent De Nous
      </h2>
      <p className="text-gray-500 mt-1 mb-8">
        Des centaines de clients satisfaits nous font confiance chaque année.
      </p>

      {google.length > 0 && (
        <AvisCarousel
          title="Avis Google"
          badgeColor="text-amber-400"
          reviews={google.map((r) => ({ id: r.id, author: r.authorName, rating: r.rating, text: r.text }))}
        />
      )}

      {facebook.length > 0 && (
        <div className="mt-10">
          <AvisCarousel
            title="Avis Facebook"
            badgeColor="text-[#1877F2]"
            reviews={facebook.map((r) => ({ id: r.id, author: r.authorName, rating: r.rating, text: r.text }))}
          />
        </div>
      )}
    </section>
  );
}
