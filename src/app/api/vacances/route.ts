import { NextResponse } from 'next/server';
import { getVacationConfig } from '@/lib/vacation';
import { buildVacationPayload, getVacationPhase } from '@/lib/vacationShared';

// Lu par le navigateur (composant VacationPopup) plutôt que dans le layout : ainsi les pages du site restent
// servies depuis le cache, et le pop-up apparaît/disparaît tout seul aux dates choisies, sans redéploiement.
export const dynamic = 'force-dynamic';

export async function GET() {
  const config = await getVacationConfig();
  const phase = getVacationPhase(config);
  const headers = { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' };
  if (phase === 'none') return NextResponse.json({ active: false }, { headers });
  return NextResponse.json({ active: true, ...buildVacationPayload(config, phase) }, { headers });
}
