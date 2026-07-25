'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdminUser } from '@/lib/supabase-server';

export async function updateZoneFee(zoneId: string, extraFee: number) {
  await requireAdminUser();
  await prisma.serviceZone.update({ where: { id: zoneId }, data: { extraFee } });
  revalidatePath('/admin/zones');
  revalidatePath('/rdv');
  revalidatePath('/');
}

export async function createZone(cityName: string, extraFee: number) {
  await requireAdminUser();
  await prisma.serviceZone.create({ data: { cityName, extraFee } });
  revalidatePath('/admin/zones');
  revalidatePath('/rdv');
  revalidatePath('/');
}

export async function deleteZone(zoneId: string) {
  await requireAdminUser();
  await prisma.serviceZone.delete({ where: { id: zoneId } });
  revalidatePath('/admin/zones');
  revalidatePath('/rdv');
  revalidatePath('/');
}
