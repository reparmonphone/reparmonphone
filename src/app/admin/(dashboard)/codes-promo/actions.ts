'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdminUser } from '@/lib/supabase-server';
import type { PromoType } from '@prisma/client';

function revalidateAll() {
  revalidatePath('/admin/codes-promo');
}

export async function createPromoCode(data: {
  code: string;
  type: PromoType;
  value: number;
  expiresAt: string;
  maxUses: string;
}) {
  await requireAdminUser();
  const code = data.code.trim().toUpperCase();
  if (!code) return { error: 'Le code est obligatoire.' };
  if (data.value <= 0) return { error: 'La valeur doit être positive.' };

  const existing = await prisma.promoCode.findUnique({ where: { code } });
  if (existing) return { error: 'Ce code existe déjà.' };

  await prisma.promoCode.create({
    data: {
      code,
      type: data.type,
      value: data.value,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      maxUses: data.maxUses ? parseInt(data.maxUses, 10) : null,
    },
  });
  revalidateAll();
  return { ok: true };
}

export async function updatePromoCode(
  id: string,
  data: { code: string; type: PromoType; value: number; active: boolean; expiresAt: string; maxUses: string }
) {
  await requireAdminUser();
  const code = data.code.trim().toUpperCase();
  if (!code) return { error: 'Le code est obligatoire.' };

  const existing = await prisma.promoCode.findUnique({ where: { code } });
  if (existing && existing.id !== id) return { error: 'Ce code est déjà utilisé par un autre.' };

  await prisma.promoCode.update({
    where: { id },
    data: {
      code,
      type: data.type,
      value: data.value,
      active: data.active,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      maxUses: data.maxUses ? parseInt(data.maxUses, 10) : null,
    },
  });
  revalidateAll();
  return { ok: true };
}

export async function deletePromoCode(id: string) {
  await requireAdminUser();
  await prisma.promoCode.delete({ where: { id } });
  revalidateAll();
  return { ok: true };
}
