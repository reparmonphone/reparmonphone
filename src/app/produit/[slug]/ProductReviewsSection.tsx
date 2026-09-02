import { prisma } from '@/lib/prisma';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import ProductStars from '@/components/ProductStars';
import ProductReviewForm from '@/components/ProductReviewForm';
import { firstNameOnly } from '@/lib/displayName';

export default async function ProductReviewsSection({ productId }: { productId: string }) {
  const reviews = await prisma.productReview.findMany({
    where: { productId },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let canReview = false;
  let alreadyReviewed = false;

  if (user) {
    const [hasPurchased, existingReview] = await Promise.all([
      prisma.orderItem.findFirst({
        where: { productId, order: { userId: user.id, status: 'DELIVERED' } },
      }),
      prisma.productReview.findFirst({ where: { productId, userId: user.id } }),
    ]);
    canReview = !!hasPurchased;
    alreadyReviewed = !!existingReview;
  }

  return (
    <div>
      {reviews.length === 0 ? (
        <p className="text-gray-500 text-sm mb-6">Aucun avis pour ce produit pour le moment.</p>
      ) : (
        <div className="space-y-4 mb-8">
          {reviews.map((r) => (
            <div key={r.id} className="border border-gray-100 rounded-xl p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-sm text-gray-800">{firstNameOnly(r.authorName)}</span>
                <span className="text-xs text-gray-400">
                  {new Date(r.createdAt).toLocaleDateString('fr-FR')}
                </span>
              </div>
              <div className="flex items-center gap-2 mb-1.5">
                <ProductStars rating={r.rating} count={1} showCount={false} />
                {r.verified && (
                  <a
                    href="/avis-verifies"
                    className="text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded font-medium hover:bg-green-100 transition"
                  >
                    ✔️ Achat vérifié
                  </a>
                )}
              </div>
              {r.text && <p className="text-sm text-gray-600">{r.text}</p>}
            </div>
          ))}
        </div>
      )}

      {user && canReview && !alreadyReviewed && <ProductReviewForm productId={productId} />}
      {user && !canReview && (
        <p className="text-sm text-gray-400">
          Tu pourras laisser un avis une fois ta commande de ce produit marquée comme livrée.
        </p>
      )}
      {!user && (
        <p className="text-sm text-gray-400">
          Connecte-toi avec le compte utilisé pour ta commande pour laisser un avis sur ce produit.
        </p>
      )}
    </div>
  );
}
