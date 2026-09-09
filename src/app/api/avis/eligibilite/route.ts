import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createSupabaseServerClient } from '@/lib/supabase-server';

// Même logique de découplage que /api/favoris : déterminer si le visiteur PEUT laisser un avis
// (connecté + commande livrée + pas déjà avisé) nécessite son cookie de session. En la sortant du
// rendu serveur de la fiche produit (ProductReviewsSection.tsx) vers cette route appelée par le
// navigateur, la fiche produit elle-même reste cacheable — l'écriture réelle (createProductReview)
// revérifie de toute façon tout côté serveur, donc aucune perte de sécurité ici.
export async function GET(req: NextRequest) {
  const productId = req.nextUrl.searchParams.get('productId');
  if (!productId) {
    return NextResponse.json({ error: 'productId manquant' }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ loggedIn: false, canReview: false, alreadyReviewed: false });
  }

  const [hasPurchased, existingReview] = await Promise.all([
    prisma.orderItem.findFirst({
      where: { productId, order: { userId: user.id, status: 'DELIVERED' } },
    }),
    prisma.productReview.findFirst({ where: { productId, userId: user.id } }),
  ]);

  return NextResponse.json({
    loggedIn: true,
    canReview: !!hasPurchased,
    alreadyReviewed: !!existingReview,
  });
}
