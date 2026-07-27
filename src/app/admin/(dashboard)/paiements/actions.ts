'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdminUser } from '@/lib/supabase-server';

export async function setPaymentMethodEnabled(provider: 'stripe' | 'sumup' | 'paypal', enabled: boolean) {
  await requireAdminUser();
  await prisma.siteSetting.upsert({
    where: { key: `payment_${provider}_enabled` },
    update: { value: String(enabled) },
    create: { key: `payment_${provider}_enabled`, value: String(enabled) },
  });
  revalidatePath('/admin/paiements');
  revalidatePath('/panier');
  return { ok: true };
}
