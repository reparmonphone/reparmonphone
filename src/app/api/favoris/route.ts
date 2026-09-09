import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createSupabaseServerClient } from '@/lib/supabase-server';

// Route appelée côté navigateur par le store Zustand (@/store/favorites) au chargement de la
// première fiche produit. On la sépare de getFavoriteProductIds() (Server Action) exprès : une
// Route Handler n'est invoquée QUE quand le client la demande, alors qu'appeler la même logique
// directement dans une Server Component force cette page entière à devenir dynamique (elle lit un
// cookie via auth.getUser()) et l'empêche d'être mise en cache — ce qui faisait exploser le CPU/
// transfert Vercel sur les fiches produit et la boutique.
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ productIds: [] });
  }

  const favorites = await prisma.favorite.findMany({
    where: { userId: user.id },
    select: { productId: true },
  });

  return NextResponse.json({ productIds: favorites.map((f) => f.productId) });
}
