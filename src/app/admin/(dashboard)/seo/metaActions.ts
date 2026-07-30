'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdminUser } from '@/lib/supabase-server';

export async function saveSiteMeta(title: string, description: string, ogImageUrl: string) {
  await requireAdminUser();

  await prisma.siteSetting.upsert({
    where: { key: 'seo_site_title' },
    update: { value: title },
    create: { key: 'seo_site_title', value: title },
  });

  await prisma.siteSetting.upsert({
    where: { key: 'seo_site_description' },
    update: { value: description },
    create: { key: 'seo_site_description', value: description },
  });

  await prisma.siteSetting.upsert({
    where: { key: 'seo_og_image_url' },
    update: { value: ogImageUrl },
    create: { key: 'seo_og_image_url', value: ogImageUrl },
  });

  // Le titre/description/image OG touchent tout le site (balise <head> globale) — on revalide largement.
  revalidatePath('/', 'layout');
  revalidatePath('/admin/seo');

  return { ok: true };
}
