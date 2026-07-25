import { prisma } from '@/lib/prisma';
import ReviewRow from './ReviewRow';
import NewReviewForm from './NewReviewForm';
import SyncGoogleButton from './SyncGoogleButton';

export default async function AdminAvisPage() {
  const reviews = await prisma.review.findMany({ orderBy: [{ source: 'asc' }, { order: 'asc' }] });

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-1">Avis clients</h1>
      <p className="text-gray-500 mb-6">
        Avis affichés en carrousel sur la page d&apos;accueil (Google + Facebook).
      </p>

      <SyncGoogleButton />

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-800">
        <strong>Avis Facebook :</strong> Facebook ne propose plus d&apos;API fiable pour récupérer automatiquement
        les avis d&apos;une page (accès restreint depuis plusieurs années, même pour les pages dont tu es
        propriétaire). Le plus simple reste de les ajouter à la main ci-dessous — ça prend 30 secondes par avis.
        Si tu veux une vraie synchronisation automatique Google + Facebook, un service comme Trustindex (que ton
        ancien site utilisait déjà) peut le faire via un widget — dis-le-moi si tu veux qu'on l'intègre à la place.
      </div>

      <div className="bg-white border border-gray-100 rounded-xl divide-y divide-gray-100 mb-6">
        {reviews.length === 0 ? (
          <p className="p-5 text-gray-500 text-sm">Aucun avis pour le moment.</p>
        ) : (
          reviews.map((r) => (
            <ReviewRow
              key={r.id}
              review={{ id: r.id, source: r.source, authorName: r.authorName, rating: r.rating, text: r.text }}
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
