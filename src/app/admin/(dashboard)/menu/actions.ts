'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdminUser } from '@/lib/supabase-server';

function revalidateAll() {
  revalidatePath('/admin/menu');
  revalidatePath('/', 'layout');
}

export async function createMenuItem(data: { label: string; href: string; openInNewTab: boolean }) {
  await requireAdminUser();
  if (!data.label.trim() || !data.href.trim()) return { error: 'Le libellé et le lien sont obligatoires.' };

  const max = await prisma.headerMenuItem.aggregate({ _max: { order: true } });
  await prisma.headerMenuItem.create({
    data: { label: data.label.trim(), href: data.href.trim(), openInNewTab: data.openInNewTab, order: (max._max.order ?? 0) + 1 },
  });
  revalidateAll();
  return { ok: true };
}

export async function updateMenuItem(
  id: string,
  data: { label: string; href: string; openInNewTab: boolean }
) {
  await requireAdminUser();
  if (!data.label.trim() || !data.href.trim()) return { error: 'Le libellé et le lien sont obligatoires.' };

  await prisma.headerMenuItem.update({
    where: { id },
    data: { label: data.label.trim(), href: data.href.trim(), openInNewTab: data.openInNewTab },
  });
  revalidateAll();
  return { ok: true };
}

export async function deleteMenuItem(id: string) {
  await requireAdminUser();
  await prisma.headerMenuItem.delete({ where: { id } });
  revalidateAll();
  return { ok: true };
}

export async function moveMenuItem(id: string, direction: 'up' | 'down') {
  await requireAdminUser();
  const items = await prisma.headerMenuItem.findMany({ orderBy: { order: 'asc' } });
  const index = items.findIndex((i) => i.id === id);
  if (index === -1) return { error: 'Introuvable.' };
  const swapIndex = direction === 'up' ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= items.length) return { ok: true };

  const a = items[index];
  const b = items[swapIndex];
  await prisma.$transaction([
    prisma.headerMenuItem.update({ where: { id: a.id }, data: { order: b.order } }),
    prisma.headerMenuItem.update({ where: { id: b.id }, data: { order: a.order } }),
  ]);
  revalidateAll();
  return { ok: true };
}
