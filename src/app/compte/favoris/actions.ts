'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { createSupabaseServerClient } from '@/lib/supabase-server';

// Récupère l'utilisateur connecté, ou null si personne n'est connecté
// (contrairement à requireAdminUser, ici ce n'est pas une erreur bloquante — un visiteur
// non connecté doit juste être invité à se connecter pour ajouter un favori).
async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

// Ajoute ou retire un produit des favoris selon son état actuel. Retourne le nouvel état.
export async function toggleFavorite(productId: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: 'NOT_LOGGED_IN' as const };
  }

  const existing = await prisma.favorite.findUnique({
    where: { userId_productId: { userId: user.id, productId } },
  });

  if (existing) {
    await prisma.favorite.delete({ where: { id: existing.id } });
    revalidatePath('/compte/favoris');
    revalidatePath('/produit/[slug]', 'page');
    return { favorited: false };
  }

  await prisma.favorite.create({ data: { userId: user.id, productId } });
  revalidatePath('/compte/favoris');
  revalidatePath('/produit/[slug]', 'page');
  return { favorited: true };
}

// Retourne l'ensemble des productId favoris du client connecté (utile pour savoir quel
// coeur afficher plein sur une liste de produits, en une seule requête).
export async function getFavoriteProductIds(): Promise<string[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const favorites = await prisma.favorite.findMany({
    where: { userId: user.id },
    select: { productId: true },
  });

  return favorites.map((f) => f.productId);
}

// Retourne les favoris avec les infos produit complètes, pour la page /compte/favoris
export async function getFavoriteProducts() {
  const user = await getCurrentUser();
  if (!user) return [];

  const favorites = await prisma.favorite.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    include: { product: true },
  });

  return favorites.map((f) => f.product);
}

export async function removeFavorite(productId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: 'NOT_LOGGED_IN' as const };

  await prisma.favorite.deleteMany({ where: { userId: user.id, productId } });
  revalidatePath('/compte/favoris');
  return { ok: true };
}
