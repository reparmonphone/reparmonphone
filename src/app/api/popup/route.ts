import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SETTING_KEY, normalizeConfig, resolveActivePromo } from '@/lib/promoPopup';

// Pop-up d'ouverture actuellement actif (voir /admin/popup). Les pages restent en cache : c'est le navigateur
// du visiteur qui vient lire ce petit JSON. Le CDN le garde 60 s, donc un changement fait dans l'admin est
// visible en ~1 minute, sans redéploiement.
export const dynamic = 'force-dynamic';

export async function GET() {
  let popup = null;
  try {
    const row = await prisma.siteSetting.findUnique({ where: { key: SETTING_KEY } });
    if (row?.value) popup = resolveActivePromo(normalizeConfig(JSON.parse(row.value)));
  } catch {
    // base indisponible ou JSON illisible : pas de pop-up, le site reste normal
  }
  return NextResponse.json(
    { popup },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
  );
}
