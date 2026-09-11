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

// Taux de commission (%) prélevé par chaque plateforme de paiement sur chaque transaction — utilisé
// uniquement pour déduire ces frais du chiffre d'affaires dans le calcul du bénéfice (/admin/benefice).
// N'affecte jamais le prix payé par le client.
export async function setFeeRate(provider: 'stripe' | 'sumup' | 'paypal', ratePercent: string) {
  await requireAdminUser();
  const rate = Math.max(0, Math.min(100, Number(ratePercent) || 0));
  await prisma.siteSetting.upsert({
    where: { key: `fee_rate_${provider}` },
    update: { value: String(rate) },
    create: { key: `fee_rate_${provider}`, value: String(rate) },
  });
  revalidatePath('/admin/paiements');
  revalidatePath('/admin/benefice');
  return { ok: true };
}
