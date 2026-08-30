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
  const zones = await prisma.shippingZone.findMany({ select: { id: true } });
  const option = await prisma.shippingOption.create({
    data: {
      label: data.label.trim(),
      description: data.description.trim() || null,
      price: data.price,
      order: (max._max.order ?? 0) + 1,
    },
  });
  // Disponible partout par défaut (France métropolitaine + toutes les zones existantes) — voir
  // schema.prisma. À restreindre ensuite au cas par cas dans le tableau "Tarifs par zone" ci-dessous.
  if (zones.length > 0) {
    await prisma.shippingOptionZone.createMany({
      data: zones.map((z) => ({ shippingOptionId: option.id, zoneId: z.id })),
      skipDuplicates: true,
    });
  }
  revalidateAll();
  return { ok: true };
}

// Active/désactive une option de livraison pour la France métropolitaine (utile pour une option qui
// n'a de sens que pour l'Outre-mer, ex: un transporteur différent).
export async function setShippingOptionMetropole(shippingOptionId: string, enabled: boolean) {
  await requireAdminUser();
  await prisma.shippingOption.update({ where: { id: shippingOptionId }, data: { availableMetropole: enabled } });
  revalidateAll();
  return { ok: true };
}

// Active/désactive une option de livraison pour une zone donnée (Outre-mer, Corse...).
export async function setShippingOptionZoneAvailability(shippingOptionId: string, zoneId: string, enabled: boolean) {
  await requireAdminUser();
  if (enabled) {
    await prisma.shippingOptionZone.upsert({
      where: { shippingOptionId_zoneId: { shippingOptionId, zoneId } },
      update: {},
      create: { shippingOptionId, zoneId },
    });
  } else {
    await prisma.shippingOptionZone.deleteMany({ where: { shippingOptionId, zoneId } });
  }
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

// ---------- Zones de livraison à tarif différent (Outre-mer, Corse, etc.) ----------
// Voir src/lib/shippingZones.ts pour la logique de détection par code postal.

function parsePrefixes(raw: string): string[] {
  return raw
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
}

export async function createShippingZone(data: { name: string; postalPrefixes: string }) {
  await requireAdminUser();
  if (!data.name.trim()) return { error: 'Le nom de la zone est obligatoire.' };
  const prefixes = parsePrefixes(data.postalPrefixes);
  if (prefixes.length === 0) return { error: 'Indique au moins un préfixe de code postal (ex: 973).' };

  const max = await prisma.shippingZone.aggregate({ _max: { order: true } });
  const options = await prisma.shippingOption.findMany({ select: { id: true } });
  const zone = await prisma.shippingZone.create({
    data: { name: data.name.trim(), postalPrefixes: prefixes, order: (max._max.order ?? 0) + 1 },
  });
  // Disponible pour toutes les options existantes par défaut — Krys peut ensuite décocher au cas par cas.
  if (options.length > 0) {
    await prisma.shippingOptionZone.createMany({
      data: options.map((o) => ({ shippingOptionId: o.id, zoneId: zone.id })),
      skipDuplicates: true,
    });
  }
  revalidateAll();
  return { ok: true };
}

export async function updateShippingZone(id: string, data: { name: string; postalPrefixes: string }) {
  await requireAdminUser();
  if (!data.name.trim()) return { error: 'Le nom de la zone est obligatoire.' };
  const prefixes = parsePrefixes(data.postalPrefixes);
  if (prefixes.length === 0) return { error: 'Indique au moins un préfixe de code postal (ex: 973).' };

  await prisma.shippingZone.update({
    where: { id },
    data: { name: data.name.trim(), postalPrefixes: prefixes },
  });
  revalidateAll();
  return { ok: true };
}

export async function deleteShippingZone(id: string) {
  await requireAdminUser();
  await prisma.shippingZone.delete({ where: { id } });
  revalidateAll();
  return { ok: true };
}

// Fixe (ou retire) le tarif spécifique d'une option de livraison pour une zone. price === null retire
// le tarif spécifique : l'option retombe alors sur son prix de base (France métropolitaine).
export async function setShippingZoneRate(shippingOptionId: string, zoneId: string, price: number | null) {
  await requireAdminUser();
  if (price === null) {
    await prisma.shippingZoneRate.deleteMany({ where: { shippingOptionId, zoneId } });
  } else {
    await prisma.shippingZoneRate.upsert({
      where: { shippingOptionId_zoneId: { shippingOptionId, zoneId } },
      update: { price },
      create: { shippingOptionId, zoneId, price },
    });
  }
  revalidateAll();
  return { ok: true };
}
