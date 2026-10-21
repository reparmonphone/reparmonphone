import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SETTING_KEY, normalizeConfig, resolveActiveTheme } from '@/lib/seasonalThemes';

// Thème saisonnier actuellement visible par les visiteurs (voir /admin/themes).
// Les pages du site restent statiques/cachées : c'est le navigateur qui vient lire ce petit JSON.
// Le CDN le garde 60 s, donc un changement fait dans l'admin est visible en ~1 minute, sans redéploiement.
export const dynamic = 'force-dynamic';

export async function GET() {
  let theme = null;
  try {
    const row = await prisma.siteSetting.findUnique({ where: { key: SETTING_KEY } });
    if (row?.value) {
      const config = normalizeConfig(JSON.parse(row.value));
      theme = resolveActiveTheme(config);
    }
  } catch {
    // base indisponible ou JSON illisible : pas de thème, le site reste normal
  }
  return NextResponse.json(
    { theme },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
  );
}
