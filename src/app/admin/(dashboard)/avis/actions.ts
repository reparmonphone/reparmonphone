'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdminUser } from '@/lib/supabase-server';
import type { ReviewSource } from '@prisma/client';

export async function createReview(data: {
  source: ReviewSource;
  authorName: string;
  rating: number | null;
  text: string;
}) {
  await requireAdminUser();
  await prisma.review.create({ data });
  revalidatePath('/admin/avis');
  revalidatePath('/');
}

export async function updateReview(
  id: string,
  data: { source: ReviewSource; authorName: string; rating: number | null; text: string }
) {
  await requireAdminUser();
  await prisma.review.update({ where: { id }, data });
  revalidatePath('/admin/avis');
  revalidatePath('/');
}

export async function deleteReview(id: string) {
  await requireAdminUser();
  await prisma.review.delete({ where: { id } });
  revalidatePath('/admin/avis');
  revalidatePath('/');
}

export async function syncGoogleReviews() {
  await requireAdminUser();

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const placeId = process.env.GOOGLE_PLACE_ID;

  if (!apiKey || !placeId) {
    return { error: "GOOGLE_PLACES_API_KEY et GOOGLE_PLACE_ID doivent être configurés dans .env (voir le README)." };
  }

  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=review,rating,user_ratings_total&language=fr&key=${apiKey}`;

  let data: {
    status: string;
    result?: { reviews?: { author_name: string; rating: number; text: string; time: number }[] };
    error_message?: string;
  };

  try {
    const res = await fetch(url);
    data = await res.json();
  } catch {
    return { error: 'Impossible de contacter l\u2019API Google Places.' };
  }

  if (data.status !== 'OK') {
    return { error: `Google a répondu : ${data.status}${data.error_message ? ` — ${data.error_message}` : ''}` };
  }

  const reviews = data.result?.reviews ?? [];
  if (reviews.length === 0) {
    return { error: 'Aucun avis retourné par Google pour cette fiche.' };
  }

  // Remplace les avis Google existants par les derniers renvoyés par l'API
  // (Google Places ne renvoie au maximum que les 5 avis les plus pertinents — c'est une limite de leur API, pas la nôtre)
  await prisma.review.deleteMany({ where: { source: 'GOOGLE' } });
  await prisma.review.createMany({
    data: reviews.map((r, i) => ({
      source: 'GOOGLE' as const,
      authorName: r.author_name,
      rating: r.rating,
      text: r.text,
      order: i,
    })),
  });

  revalidatePath('/admin/avis');
  revalidatePath('/');
  return { count: reviews.length };
}
