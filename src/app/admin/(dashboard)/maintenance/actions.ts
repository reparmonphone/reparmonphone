'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdminUser } from '@/lib/supabase-server';

export async function setMaintenanceMode(enabled: boolean) {
  await requireAdminUser();
  await prisma.siteSetting.upsert({
    where: { key: 'maintenance_mode' },
    update: { value: String(enabled) },
    create: { key: 'maintenance_mode', value: String(enabled) },
  });
  revalidatePath('/', 'layout');
  revalidatePath('/admin/maintenance');
  return { ok: true };
}
