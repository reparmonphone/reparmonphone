'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdminUser } from '@/lib/supabase-server';

function revalidateAll() {
  revalidatePath('/admin/livraison');
  revalidatePath('/panier');
}

export async function createShippingOption(data: { label: string; description: string; price: number }) {
  await requireAdminUser();
  if (!data.label.trim()) return { error: 'Le libellé est obligatoire.' };

  const max = await prisma.shippingOption.aggregate({ _max: { order: true } });
  await prisma.shippingOption.create({
    data: {
      label: data.label.trim(),
      description: data.description.trim() || null,
      price: data.price,
      order: (max._max.order ?? 0) + 1,
    },
  });
  revalidateAll();
  return { ok: true };
}

export async function updateShippingOption(
  id: string,
  data: { label: string; description: string; price: number; active: boolean }
) {
  await requireAdminUser();
  if (!data.label.trim()) return { error: 'Le libellé est obligatoire.' };
  await prisma.shippingOption.update({
    where: { id },
    data: {
      label: data.label.trim(),
      description: data.description.trim() || null,
      price: data.price,
      active: data.active,
    },
  });
  revalidateAll();
  return { ok: true };
}

export async function deleteShippingOption(id: string) {
  await requireAdminUser();
  await prisma.shippingOption.delete({ where: { id } });
  revalidateAll();
  return { ok: true };
}

export async function moveShippingOption(id: string, direction: 'up' | 'down') {
  await requireAdminUser();
  const options = await prisma.shippingOption.findMany({ orderBy: { order: 'asc' } });
  const index = options.findIndex((o) => o.id === id);
  if (index === -1) return { error: 'Introuvable.' };
  const swapIndex = direction === 'up' ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= options.length) return { ok: true };

  const a = options[index];
  const b = options[swapIndex];
  await prisma.$transaction([
    prisma.shippingOption.update({ where: { id: a.id }, data: { order: b.order } }),
    prisma.shippingOption.update({ where: { id: b.id }, data: { order: a.order } }),
  ]);
  revalidateAll();
  return { ok: true };
}
