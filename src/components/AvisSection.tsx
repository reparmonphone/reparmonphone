import { prisma } from '@/lib/prisma';
import AvisCarousel from './AvisCarousel';
import { firstNameOnly } from '@/lib/displayName';

export default async function AvisSection() {
  const [reviews, settings] = await Promise.all([
    prisma.review.findMany({ orderBy: [{ source: 'asc' }, { order: 'asc' }] }),
    prisma.siteSetting.findMany({
      where: { key: { in: ['google_reviews_total', 'google_reviews_average', 'facebook_reviews_total', 'facebook_reviews_average'] } },
    }),
  ]);

  const getSetting = (key: string) => settings.find((s) => s.key === key)?.value ?? null;

  const google = reviews.filter((r) => r.source === 'GOOGLE');
  const facebook = [...reviews.filter((r) => r.source === 'FACEBOOK')].sort((a, b) => {
    const dateA = a.reviewDate ?? a.createdAt;
    const dateB = b.reviewDate ?? b.createdAt;
    return dateB.getTime() - dateA.getTime();
  });

  if (google.length === 0 && facebook.length === 0) return null;

  // Prénom uniquement côté public (demandé par Krys) — le nom complet reste en base et visible
  // tel quel dans /admin/avis pour la gestion.
  const toReviewItem = (r: (typeof reviews)[number]) => ({
    id: r.id,
    author: firstNameOnly(r.authorName),
    authorPhotoUrl: r.authorPhotoUrl,
    rating: r.rating,
    text: r.text,
    reviewDate: r.reviewDate ? r.reviewDate.toISOString() : null,
    verified: r.verified,
  });

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
          sourceIcon={<GoogleIcon />}
          sourceLogo={<GoogleLogo />}
          sourceName="Google"
          mode="grid"
          maxItems={4}
          average={getSetting('google_reviews_average') ? Number(getSetting('google_reviews_average')) : null}
          total={getSetting('google_reviews_total') ? Number(getSetting('google_reviews_total')) : null}
          reviews={google.map(toReviewItem)}
        />
      )}

      {facebook.length > 0 && (
        <div className="mt-10">
          <AvisCarousel
            title="Avis Facebook"
            sourceIcon={<FacebookIcon />}
            sourceLogo={<FacebookLogo />}
            sourceName="Facebook"
            starColor="text-[#1877F2]"
            maxItems={5}
            average={getSetting('facebook_reviews_average') ? Number(getSetting('facebook_reviews_average')) : null}
            total={getSetting('facebook_reviews_total') ? Number(getSetting('facebook_reviews_total')) : null}
            reviews={facebook.map(toReviewItem)}
          />
        </div>
      )}
    </section>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.4 0 10.3-2.1 14-5.5l-6.5-5.5c-2 1.4-4.6 2.3-7.5 2.3-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.5 5.5C39.9 37.4 44 31.4 44 24c0-1.3-.1-2.7-.4-3.5z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48">
      <circle cx="24" cy="24" r="24" fill="#1877F2" />
      <path
        fill="#fff"
        d="M27.5 24.9h4l.6-4.2h-4.6v-2.7c0-1.2.3-2 2.1-2h2.2v-3.8c-.4-.1-1.7-.2-3.2-.2-3.2 0-5.4 2-5.4 5.5v3.2h-3.6v4.2h3.6V35h4.3V24.9z"
      />
    </svg>
  );
}

function GoogleLogo() {
  return (
    <svg width="74" height="24" viewBox="0 0 74 24" xmlns="http://www.w3.org/2000/svg">
      <text x="0" y="18" fontFamily="Arial, sans-serif" fontSize="18" fontWeight="700">
        <tspan fill="#4285F4">G</tspan>
        <tspan fill="#EA4335">o</tspan>
        <tspan fill="#FBBC05">o</tspan>
        <tspan fill="#4285F4">g</tspan>
        <tspan fill="#34A853">l</tspan>
        <tspan fill="#EA4335">e</tspan>
      </text>
    </svg>
  );
}

function FacebookLogo() {
  return <span className="text-[#1877F2] font-bold text-lg">facebook</span>;
}
