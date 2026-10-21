'use server';

import { prisma } from '@/lib/prisma';
import { requireAdminUser } from '@/lib/supabase-server';
import { SETTING_KEY, normalizeConfig } from '@/lib/seasonalThemes';

// Enregistre la configuration des thèmes saisonniers (activation, dates, effets, bandeau).
// Rien n'est visible des visiteurs tant que "enabled" est faux. Les visiteurs voient le changement
// en ~1 minute (cache CDN de /api/theme), sans redéploiement.
export async function saveSeasonalConfig(raw: unknown) {
  await requireAdminUser();
  const config = normalizeConfig(raw);
  if (config.scheduleEnabled && config.end < config.start) {
    return { error: 'La date de fin doit être après la date de début.' };
  }
  const value = JSON.stringify(config);
  await prisma.siteSetting.upsert({
    where: { key: SETTING_KEY },
    update: { value },
    create: { key: SETTING_KEY, value },
  });
  return { ok: true as const, config };
}
