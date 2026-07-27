'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdminUser } from '@/lib/supabase-server';
import type { ReviewSource } from '@prisma/client';

function revalidateAll() {
  revalidatePath('/admin/avis');
  revalidatePath('/');
}

type ReviewInput = {
  source: ReviewSource;
  authorName: string;
  authorPhotoUrl: string;
  rating: number | null;
  text: string;
  reviewDate: string; // yyyy-mm-dd depuis un <input type="date">
  verified: boolean;
};

export async function createReview(data: ReviewInput) {
  await requireAdminUser();
  await prisma.review.create({
    data: {
      source: data.source,
      authorName: data.authorName,
      authorPhotoUrl: data.authorPhotoUrl || null,
      rating: data.rating,
      text: data.text,
      reviewDate: data.reviewDate ? new Date(data.reviewDate) : null,
      verified: data.verified,
    },
  });
  revalidateAll();
}

export async function updateReview(id: string, data: ReviewInput) {
  await requireAdminUser();
  await prisma.review.update({
    where: { id },
    data: {
      source: data.source,
      authorName: data.authorName,
      authorPhotoUrl: data.authorPhotoUrl || null,
      rating: data.rating,
      text: data.text,
      reviewDate: data.reviewDate ? new Date(data.reviewDate) : null,
      verified: data.verified,
    },
  });
  revalidateAll();
}

export async function deleteReview(id: string) {
  await requireAdminUser();
  await prisma.review.delete({ where: { id } });
  revalidateAll();
}

// Résumé affiché en haut du carrousel ("EXCELLENT ★★★★★ Basé sur 127 avis") — modifiable pour
// refléter le vrai total Google/Facebook, même si seuls quelques avis sont affichés en détail.
export async function updateReviewsSummary(
  source: 'google' | 'facebook',
  data: { total: string; average: string }
) {
  await requireAdminUser();
  await prisma.siteSetting.upsert({
    where: { key: `${source}_reviews_total` },
    update: { value: data.total },
    create: { key: `${source}_reviews_total`, value: data.total },
  });
  await prisma.siteSetting.upsert({
    where: { key: `${source}_reviews_average` },
    update: { value: data.average },
    create: { key: `${source}_reviews_average`, value: data.average },
  });
  revalidateAll();
  return { ok: true };
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
    result?: {
      rating?: number;
      user_ratings_total?: number;
      reviews?: {
        author_name: string;
        profile_photo_url?: string;
        rating: number;
        text: string;
        time: number; // timestamp unix (secondes)
      }[];
    };
    error_message?: string;
  };

  try {
    const res = await fetch(url);
    data = await res.json();
  } catch {
    return { error: 'Impossible de contacter l\u2019API Google Places.' };
  }

  if (data.status !== 'OK') {
    if (data.status === 'REQUEST_DENIED' && data.error_message?.includes('Billing')) {
      return {
        error:
          "Google exige d'activer la facturation sur ton projet Google Cloud pour utiliser l'API Places (même si tu ne seras quasiment jamais facturé — 200$ de crédit gratuit par mois). Active-la sur console.cloud.google.com → Facturation, puis réessaie.",
      };
    }
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
      authorPhotoUrl: r.profile_photo_url ?? null,
      rating: r.rating,
      text: r.text,
      reviewDate: new Date(r.time * 1000),
      verified: true,
      order: i,
    })),
  });

  // La note globale et le nombre total d'avis (ex: 4.8, 127) viennent aussi de Google — on les enregistre
  // pour le résumé "EXCELLENT ★★★★★ Basé sur X avis", même si Google ne renvoie que 5 avis en détail.
  if (data.result?.rating !== undefined) {
    await prisma.siteSetting.upsert({
      where: { key: 'google_reviews_average' },
      update: { value: String(data.result.rating) },
      create: { key: 'google_reviews_average', value: String(data.result.rating) },
    });
  }
  if (data.result?.user_ratings_total !== undefined) {
    await prisma.siteSetting.upsert({
      where: { key: 'google_reviews_total' },
      update: { value: String(data.result.user_ratings_total) },
      create: { key: 'google_reviews_total', value: String(data.result.user_ratings_total) },
    });
  }

  revalidateAll();
  return { count: reviews.length };
}
