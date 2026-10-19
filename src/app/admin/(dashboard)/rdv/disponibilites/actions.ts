'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdminUser } from '@/lib/supabase-server';
import { addDays } from '@/lib/rdvAvailability';

type Period = 'DAY' | 'MORNING' | 'AFTERNOON';

function refresh() {
  revalidatePath('/admin/rdv/disponibilites');
  revalidatePath('/rdv');
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Interrupteur rapide d'un créneau (matin ou après-midi) d'une date précise.
//  open = true  → on rouvre le créneau ; open = false → on le ferme.
// (Un blocage « chaque semaine » ne se change pas ici : il se supprime dans la liste en dessous.)
export async function setSlotOpen(date: string, period: 'MORNING' | 'AFTERNOON', open: boolean) {
  await requireAdminUser();
  if (!DATE_RE.test(date)) return { error: 'Date invalide.' };
  const other = period === 'MORNING' ? 'AFTERNOON' : 'MORNING';

  const existing = await prisma.rdvBlock.findMany({ where: { date } });
  const dayBlock = existing.find((b) => b.period === 'DAY');
  const samePeriod = existing.find((b) => b.period === period);
  const otherPeriod = existing.find((b) => b.period === other);

  if (open) {
    if (dayBlock) {
      // Journée entière fermée → on la remplace par la seule autre moitié de journée
      await prisma.$transaction([
        prisma.rdvBlock.delete({ where: { id: dayBlock.id } }),
        prisma.rdvBlock.create({ data: { date, period: other, note: dayBlock.note } }),
      ]);
    } else if (samePeriod) {
      await prisma.rdvBlock.delete({ where: { id: samePeriod.id } });
    }
  } else if (!dayBlock && !samePeriod) {
    if (otherPeriod) {
      // Matin + après-midi fermés = journée entière
      await prisma.$transaction([
        prisma.rdvBlock.delete({ where: { id: otherPeriod.id } }),
        prisma.rdvBlock.create({ data: { date, period: 'DAY', note: otherPeriod.note } }),
      ]);
    } else {
      await prisma.rdvBlock.create({ data: { date, period } });
    }
  }

  refresh();
  return { ok: true };
}

// Fermer une période (un jour, plusieurs jours d'affilée, ou chaque semaine).
export async function addBlocks(input: {
  mode: 'dates' | 'weekly';
  from?: string;
  to?: string;
  weekday?: number;
  period: Period;
  note?: string;
}) {
  await requireAdminUser();
  const note = input.note?.trim().slice(0, 120) || null;

  if (input.mode === 'weekly') {
    const weekday = Number(input.weekday);
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return { error: 'Jour de la semaine invalide.' };
    const dup = await prisma.rdvBlock.findFirst({ where: { date: null, weekday, period: input.period } });
    if (!dup) await prisma.rdvBlock.create({ data: { weekday, period: input.period, note } });
    refresh();
    return { ok: true, created: dup ? 0 : 1 };
  }

  const from = input.from ?? '';
  const to = input.to || from;
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) return { error: 'Choisis une date de début (et de fin si plusieurs jours).' };
  if (to < from) return { error: 'La date de fin est avant la date de début.' };

  const dates: string[] = [];
  for (let d = from; d <= to && dates.length < 180; d = addDays(d, 1)) dates.push(d);

  // Journée entière : remplace tout ce qui existait ces jours-là. Matin / après-midi : on ignore les jours déjà
  // fermés en journée entière, et on évite les doublons.
  let targets = dates;
  if (input.period !== 'DAY') {
    const alreadyClosed = new Set(
      (await prisma.rdvBlock.findMany({ where: { date: { in: dates }, period: 'DAY' }, select: { date: true } })).map(
        (b) => b.date
      )
    );
    targets = dates.filter((d) => !alreadyClosed.has(d));
  }

  await prisma.$transaction([
    prisma.rdvBlock.deleteMany({
      where: { date: { in: targets }, ...(input.period === 'DAY' ? {} : { period: input.period }) },
    }),
    prisma.rdvBlock.createMany({ data: targets.map((date) => ({ date, period: input.period, note })) }),
  ]);

  refresh();
  return { ok: true, created: targets.length };
}

export async function deleteBlock(id: string) {
  await requireAdminUser();
  await prisma.rdvBlock.deleteMany({ where: { id } });
  refresh();
  return { ok: true };
}
