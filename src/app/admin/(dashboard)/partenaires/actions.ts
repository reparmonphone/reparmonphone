'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdminUser } from '@/lib/supabase-server';

export async function createPartner(data: { name: string; logoUrl: string | null; linkUrl: string }) {
  await requireAdminUser();
  const max = await prisma.partner.aggregate({ _max: { order: true } });
  await prisma.partner.create({ data: { ...data, order: (max._max.order ?? 0) + 1 } });
  revalidatePath('/admin/partenaires');
  revalidatePath('/');
}

export async function updatePartner(id: string, data: { name: string; logoUrl: string | null; linkUrl: string }) {
  await requireAdminUser();
  await prisma.partner.update({ where: { id }, data });
  revalidatePath('/admin/partenaires');
  revalidatePath('/');
}

export async function deletePartner(id: string) {
  await requireAdminUser();
  await prisma.partner.delete({ where: { id } });
  revalidatePath('/admin/partenaires');
  revalidatePath('/');
}

export async function createReferralLink(data: { label: string; url: string }) {
  await requireAdminUser();
  const max = await prisma.referralLink.aggregate({ _max: { order: true } });
  await prisma.referralLink.create({ data: { ...data, order: (max._max.order ?? 0) + 1 } });
  revalidatePath('/admin/partenaires');
  revalidatePath('/');
}

export async function deleteReferralLink(id: string) {
  await requireAdminUser();
  await prisma.referralLink.delete({ where: { id } });
  revalidatePath('/admin/partenaires');
  revalidatePath('/');
}

export async function updateInstagramFollowers(value: string) {
  await requireAdminUser();
  await prisma.siteSetting.upsert({
    where: { key: 'instagram_followers' },
    update: { value: value.trim() },
    create: { key: 'instagram_followers', value: value.trim() },
  });
  revalidatePath('/admin/partenaires');
  revalidatePath('/');
  return { ok: true };
}

// Comptes exacts (nombres entiers) utilisés par le compteur à volets façon Smiirl sur la page d'accueil —
// distincts des libellés abrégés ("1,9K") affichés ailleurs.
export async function updateSocialFollowersCount(platform: 'facebook' | 'instagram', value: string) {
  await requireAdminUser();
  const key = `${platform}_followers_count`;
  await prisma.siteSetting.upsert({
    where: { key },
    update: { value: value.trim() },
    create: { key, value: value.trim() },
  });
  revalidatePath('/admin/partenaires');
  revalidatePath('/');
  return { ok: true };
}
