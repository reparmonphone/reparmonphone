import Link from 'next/link';
import Image from 'next/image';
import { prisma } from '@/lib/prisma';
import ProductStars from '@/components/ProductStars';

export const metadata = { title: 'Avis Vérifiés' };

// Cette page était jusqu'ici uniquement explicative (ce que signifie le badge "Achat vérifié") —
// elle affiche maintenant aussi les avis vérifiés eux-mêmes, avec le produit concerné, pour que
// les visiteurs qui cliquent sur le badge (bas de page, ou le badge flottant en bas à gauche,
// voir VerifiedReviewsFloatingBadge.tsx) retrouvent bien de vrais avis ici.
export default async function AvisVerifiesPage() {
  const [reviews, agg] = await Promise.all([
    prisma.productReview.findMany({
      where: { verified: true },
      orderBy: { createdAt: 'desc' },
      take: 60,
      include: {
        product: { select: { slug: true, title: true, imageUrl: true } },
      },
    }),
    prisma.productReview.aggregate({
      where: { verified: true },
      _avg: { rating: true },
      _count: { rating: true },
    }),
  ]);

  const average = agg._avg.rating;
  const count = agg._count.rating;

  return (
    <div className="max-w-5xl mx-auto px-4 py-16">
      <div className="flex items-center gap-3 mb-2">
        <ShieldIcon />
        <h1 className="text-2xl font-bold text-gray-900">Avis Vérifiés</h1>
      </div>

      {!!average && !!count && (
        <div className="flex items-center gap-2 mb-8">
          <ProductStars rating={average} count={count} size="text-lg" />
          <span className="text-sm text-gray-500">
            {average.toFixed(1).replace('.', ',')}/5 sur {count} avis vérifié{count > 1 ? 's' : ''}
          </span>
        </div>
      )}

      {reviews.length === 0 ? (
        <p className="text-gray-500 text-sm mb-12">Aucun avis vérifié pour le moment.</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4 mb-12">
          {reviews.map((r) => (
            <div key={r.id} className="border border-gray-100 rounded-xl p-4 flex gap-3">
              {r.product && (
                <Link href={`/produit/${r.product.slug}`} className="shrink-0">
                  <div className="w-16 h-16 rounded-lg bg-gray-50 border border-gray-100 overflow-hidden flex items-center justify-center">
                    {r.product.imageUrl ? (
                      <Image
                        src={r.product.imageUrl}
                        alt={r.product.title}
                        width={64}
                        height={64}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </div>
                </Link>
              )}

              <div className="min-w-0 flex-1">
                {r.product && (
                  <Link
                    href={`/produit/${r.product.slug}`}
                    className="text-xs font-medium text-brand hover:underline block truncate mb-1"
                  >
                    {r.product.title}
                  </Link>
                )}
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm text-gray-800">{r.authorName}</span>
                  <span className="text-xs text-gray-400 shrink-0 ml-2">
                    {new Date(r.createdAt).toLocaleDateString('fr-FR')}
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-1.5">
                  <ProductStars rating={r.rating} count={1} showCount={false} />
                  <span className="text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded font-medium">
                    ✔️ Achat vérifié
                  </span>
                </div>
                {r.text && <p className="text-sm text-gray-600">{r.text}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white border border-gray-100 rounded-xl p-6 space-y-4 text-gray-700 leading-relaxed">
        <p>
          Sur ReparMonPhone, le badge <strong>"✔️ Achat vérifié"</strong> qui accompagne certains avis produits
          garantit que la personne ayant laissé cet avis a réellement acheté ce produit sur notre site, et que
          sa commande a bien été livrée.
        </p>

        <div className="bg-brand-light border border-brand/20 rounded-lg p-4">
          <p className="font-semibold text-brand-dark mb-1">Depuis quand ?</p>
          <p className="text-sm">
            Ce système de vérification est en place depuis <strong>août 2026</strong>. Les avis publiés avant
            cette date (notamment ceux importés depuis notre historique de plus de 15 ans d&apos;activité)
            n&apos;ont pas pu être vérifiés de cette façon et n&apos;affichent donc pas ce badge — cela ne
            signifie pas qu&apos;ils sont moins authentiques, simplement que ce contrôle automatique n&apos;existait
            pas encore à l&apos;époque.
          </p>
        </div>

        <div>
          <p className="font-semibold text-gray-800 mb-1">Comment un avis devient-il "vérifié" ?</p>
          <ul className="list-disc list-inside text-sm space-y-1">
            <li>Le client doit être connecté à son compte ReparMonPhone.</li>
            <li>Il doit avoir passé commande du produit concerné directement sur notre site.</li>
            <li>Sa commande doit être passée au statut "Livrée".</li>
            <li>Un seul avis vérifié possible par client et par produit.</li>
          </ul>
        </div>

        <p className="text-sm text-gray-500">
          Nous appliquons ce contrôle pour garantir à nos visiteurs des retours fiables et représentatifs de
          l&apos;expérience réelle de nos clients.
        </p>
      </div>
    </div>
  );
}

function ShieldIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 2L4 5v6c0 5.5 3.4 10.2 8 11.5 4.6-1.3 8-6 8-11.5V5l-8-3z"
        fill="#0E7FDB"
      />
      <path
        d="M9 12.5l2 2 4-4.5"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
