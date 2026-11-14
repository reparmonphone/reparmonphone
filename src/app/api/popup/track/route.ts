import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SETTING_KEY, normalizeConfig, statsIdFor } from '@/lib/promoPopup';
import { recordPromoEvent } from '@/lib/promoStats';

// Compteurs du pop-up d'ouverture (affichages et clics), lus dans /admin/popup.
// Répond toujours 204 : le visiteur ne doit jamais voir une erreur à cause d'un compteur.
export const dynamic = 'force-dynamic';

const BOT = /bot|crawl|spider|slurp|headless|lighthouse|pingdom|preview|facebookexternalhit|monitor/i;
const ok = () => new NextResponse(null, { status: 204 });

export async function POST(req: Request) {
  try {
    const site = req.headers.get('sec-fetch-site');
    if (BOT.test(req.headers.get('user-agent') ?? '') || (site && site !== 'same-origin')) return ok();

    const body = (await req.json().catch(() => null)) as { id?: unknown; event?: unknown } | null;
    const id = typeof body?.id === 'string' && /^[a-z0-9]{1,12}$/.test(body.id) ? body.id : null;
    const event = body?.event === 'view' || body?.event === 'click' ? body.event : null;
    if (!id || !event) return ok();

    // On ne compte que pour l'offre actuellement réglée dans l'admin (pas de lignes inventées).
    const row = await prisma.siteSetting.findUnique({ where: { key: SETTING_KEY } });
    if (!row?.value) return ok();
    const config = normalizeConfig(JSON.parse(row.value));
    if (!config.ctaHref || statsIdFor(config.ctaHref) !== id) return ok();

    await recordPromoEvent(id, event);
  } catch {
    // jamais bloquant
  }
  return ok();
}
