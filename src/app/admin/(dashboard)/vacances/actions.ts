'use server';

import { revalidatePath } from 'next/cache';
import { requireAdminUser } from '@/lib/supabase-server';
import { saveVacationConfig } from '@/lib/vacation';
import { isValidRange, type VacationConfig } from '@/lib/vacationShared';

const clip = (s: unknown, max: number) => String(s ?? '').trim().slice(0, max);

export async function saveVacation(input: VacationConfig) {
  await requireAdminUser();

  const config: VacationConfig = {
    enabled: !!input.enabled,
    start: clip(input.start, 10),
    end: clip(input.end, 10),
    announceDays: Math.min(30, Math.max(0, Math.round(Number(input.announceDays) || 0))),
    title: clip(input.title, 80),
    message: clip(input.message, 400),
    titleBefore: clip(input.titleBefore, 80),
    messageBefore: clip(input.messageBefore, 400),
    orderTitle: clip(input.orderTitle, 90),
    orderInfo: clip(input.orderInfo, 300),
    mediaUrl: clip(input.mediaUrl, 300),
    showContact: !!input.showContact,
  };

  if (config.enabled && !isValidRange(config.start, config.end)) {
    return { error: 'Choisis une date de départ et une date de retour (la fin ne peut pas être avant le début) avant d’activer.' };
  }
  if (!config.title || !config.message) {
    return { error: 'Le titre et le message « pendant les vacances » ne peuvent pas être vides.' };
  }

  if (config.mediaUrl && !/^(\/[\w\-./%]+|https:\/\/\S+)$/.test(config.mediaUrl)) {
    return { error: 'Le fichier du visuel doit être un chemin du type /vacances/plage.mp4 ou une adresse https://… (laisse vide pour garder l’animation intégrée).' };
  }

  await saveVacationConfig(config);
  revalidatePath('/admin/vacances');
  revalidatePath('/rdv');
  return { ok: true };
}
