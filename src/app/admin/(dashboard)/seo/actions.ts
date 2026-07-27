'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdminUser } from '@/lib/supabase-server';
import { pingIndexNow } from '@/lib/indexnow';

export async function updateSeoVerification(data: { googleVerification: string; bingVerification: string }) {
  await requireAdminUser();
  await Promise.all([
    prisma.siteSetting.upsert({
      where: { key: 'seo_google_verification' },
      update: { value: data.googleVerification.trim() },
      create: { key: 'seo_google_verification', value: data.googleVerification.trim() },
    }),
    prisma.siteSetting.upsert({
      where: { key: 'seo_bing_verification' },
      update: { value: data.bingVerification.trim() },
      create: { key: 'seo_bing_verification', value: data.bingVerification.trim() },
    }),
  ]);
  revalidatePath('/admin/seo');
  return { ok: true };
}

export async function createRedirect(data: { fromPath: string; toPath: string; statusCode: number }) {
  await requireAdminUser();
  const fromPath = data.fromPath.trim();
  const toPath = data.toPath.trim();
  if (!fromPath.startsWith('/') || !toPath.startsWith('/')) {
    return { error: 'Les deux chemins doivent commencer par "/".' };
  }
  const existing = await prisma.redirect.findUnique({ where: { fromPath } });
  if (existing) return { error: 'Une redirection existe déjà pour cette URL de départ.' };

  await prisma.redirect.create({ data: { fromPath, toPath, statusCode: data.statusCode } });
  revalidatePath('/admin/seo');
  return { ok: true };
}

export async function deleteRedirect(id: string) {
  await requireAdminUser();
  await prisma.redirect.delete({ where: { id } });
  revalidatePath('/admin/seo');
  return { ok: true };
}

export async function resubmitAllToIndexNow() {
  await requireAdminUser();
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.reparmonphone.fr';

  const products = await prisma.product.findMany({ where: { showInBoutique: true }, select: { slug: true } });
  const urls = [
    site,
    `${site}/boutique`,
    ...products.map((p) => `${site}/produit/${p.slug}`),
  ];

  // IndexNow limite généralement à 10 000 URLs par requête — largement suffisant ici, mais on découpe par sécurité.
  const chunks = [];
  for (let i = 0; i < urls.length; i += 500) chunks.push(urls.slice(i, i + 500));
  for (const chunk of chunks) {
    await pingIndexNow(chunk);
  }

  return { ok: true, count: urls.length };
}
