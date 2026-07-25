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
