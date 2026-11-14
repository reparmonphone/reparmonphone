import { prisma } from '@/lib/prisma';
import { parisToday } from '@/lib/seasonalThemes';

// Compteurs du pop-up d'ouverture : un nombre d'affichages et un nombre de clics, jour par jour.
// Stockés dans site_settings (une ligne par offre, par type et par jour) : aucune migration de base nécessaire.
// Données purement statistiques : pas d'adresse IP, pas d'identifiant, pas de cookie.

export type PromoEvent = 'view' | 'click';

const PREFIX = 'promo_stats:';
export const statsPrefix = (id: string) => `${PREFIX}${id}:`;

// +1 de façon atomique (deux visiteurs au même instant ne se « mangent » pas).
export async function recordPromoEvent(id: string, event: PromoEvent) {
  const key = `${statsPrefix(id)}${event}:${parisToday()}`;
  await prisma.$executeRaw`
    INSERT INTO site_settings ("key", "value", "updatedAt")
    VALUES (${key}, '1', NOW())
    ON CONFLICT ("key") DO UPDATE
    SET "value" = (site_settings."value"::int + 1)::text, "updatedAt" = NOW()`;
}

export type PromoStats = {
  views: number;
  clicks: number;
  since: string | null; // premier jour avec des données
  days: { day: string; views: number; clicks: number }[]; // du plus récent au plus ancien
};

export async function readPromoStats(id: string): Promise<PromoStats> {
  const rows = await prisma.siteSetting.findMany({
    where: { key: { startsWith: statsPrefix(id) } },
    select: { key: true, value: true },
  });
  const byDay = new Map<string, { views: number; clicks: number }>();
  let views = 0;
  let clicks = 0;
  for (const r of rows) {
    const [, , event, day] = r.key.split(':');
    const n = Number.parseInt(r.value, 10);
    if (!day || !Number.isFinite(n)) continue;
    const d = byDay.get(day) ?? { views: 0, clicks: 0 };
    if (event === 'view') {
      d.views += n;
      views += n;
    } else if (event === 'click') {
      d.clicks += n;
      clicks += n;
    } else continue;
    byDay.set(day, d);
  }
  const days = Array.from(byDay.entries())
    .map(([day, v]) => ({ day, ...v }))
    .sort((a, b) => (a.day < b.day ? 1 : -1));
  return { views, clicks, since: days.length ? days[days.length - 1].day : null, days };
}
