import { prisma } from '@/lib/prisma';
import ReviewRow from './ReviewRow';
import NewReviewForm from './NewReviewForm';
import SyncGoogleButton from './SyncGoogleButton';
import ReviewsSummaryForm from './ReviewsSummaryForm';

export default async function AdminAvisPage() {
  const [reviews, settings] = await Promise.all([
    prisma.review.findMany({ orderBy: [{ source: 'asc' }, { order: 'asc' }] }),
    prisma.siteSetting.findMany({
      where: { key: { in: ['google_reviews_total', 'google_reviews_average', 'facebook_reviews_total', 'facebook_reviews_average'] } },
    }),
  ]);

  const getSetting = (key: string) => settings.find((s) => s.key === key)?.value ?? '';

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-1">Avis clients</h1>
      <p className="text-gray-500 mb-6">
        Avis affichés en carrousel automatique sur la page d&apos;accueil (Google + Facebook), avec un résumé
        "Excellent ★★★★★ Basé sur X avis" façon Trustindex.
      </p>

      <div className="bg-white border border-gray-100 rounded-xl p-5 mb-6 space-y-3">
        <h2 className="font-semibold mb-1">Résumé affiché au-dessus des carrousels</h2>
        <ReviewsSummaryForm source="google" label="Google" initialTotal={getSetting('google_reviews_total')} initialAverage={getSetting('google_reviews_average')} />
        <ReviewsSummaryForm source="facebook" label="Facebook" initialTotal={getSetting('facebook_reviews_total')} initialAverage={getSetting('facebook_reviews_average')} />
        <p className="text-xs text-gray-400">
          La synchronisation Google (bouton ci-dessous) remplit automatiquement la ligne Google — modifie-la ici
          seulement si besoin. La ligne Facebook reste manuelle (voir l&apos;encadré plus bas).
        </p>
      </div>

      <SyncGoogleButton />

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-800">
        <strong>Avis Facebook :</strong> Facebook ne propose plus d&apos;API fiable pour récupérer automatiquement
        les avis d&apos;une page (accès restreint depuis plusieurs années, même pour les pages dont tu es
        propriétaire). Le plus simple reste de les ajouter à la main ci-dessous — ça prend 30 secondes par avis.
      </div>

      <div className="bg-white border border-gray-100 rounded-xl divide-y divide-gray-100 mb-6">
        {reviews.length === 0 ? (
          <p className="p-5 text-gray-500 text-sm">Aucun avis pour le moment.</p>
        ) : (
          reviews.map((r) => (
            <ReviewRow
              key={r.id}
              review={{
                id: r.id,
                source: r.source,
                authorName: r.authorName,
                authorPhotoUrl: r.authorPhotoUrl,
                rating: r.rating,
                text: r.text,
                reviewDate: r.reviewDate ? r.reviewDate.toISOString().slice(0, 10) : null,
                verified: r.verified,
              }}
            />
          ))
        )}
      </div>

      <div className="bg-white border border-gray-100 rounded-xl p-5">
        <h2 className="font-semibold mb-3">Ajouter un avis manuellement</h2>
        <NewReviewForm />
      </div>
    </div>
  );
}
