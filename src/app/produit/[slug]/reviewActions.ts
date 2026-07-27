'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { createSupabaseServerClient } from '@/lib/supabase-server';

async function recomputeProductRating(productId: string) {
  const agg = await prisma.productReview.aggregate({
    where: { productId },
    _avg: { rating: true },
    _count: { rating: true },
  });
  await prisma.product.update({
    where: { id: productId },
    data: {
      avgRating: agg._avg.rating,
      reviewCount: agg._count.rating,
    },
  });
}

export async function createProductReview(
  productId: string,
  data: { rating: number; text: string }
) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'Connecte-toi pour laisser un avis.' };
  if (data.rating < 1 || data.rating > 5) return { error: 'Note invalide.' };

  // Un avis ne peut être laissé qu'une fois la commande reçue (statut "Livrée")
  const hasPurchased = await prisma.orderItem.findFirst({
    where: {
      productId,
      order: { userId: user.id, status: 'DELIVERED' },
    },
  });
  if (!hasPurchased) {
    return { error: "Tu peux laisser un avis une fois ta commande marquée comme livrée." };
  }

  const existing = await prisma.productReview.findFirst({ where: { productId, userId: user.id } });
  if (existing) {
    return { error: 'Tu as déjà laissé un avis pour ce produit.' };
  }

  const meta = user.user_metadata ?? {};
  const authorName = [meta.first_name, meta.last_name].filter(Boolean).join(' ') || 'Client ReparMonPhone';

  await prisma.productReview.create({
    data: {
      productId,
      userId: user.id,
      authorName,
      rating: data.rating,
      text: data.text.trim() || null,
      verified: true,
    },
  });

  await recomputeProductRating(productId);

  revalidatePath('/produit');
  revalidatePath('/boutique');
  return { ok: true };
}
