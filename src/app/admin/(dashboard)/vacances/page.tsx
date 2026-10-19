import { getVacationConfig } from '@/lib/vacation';
import { formatRange, getVacationPhase } from '@/lib/vacationShared';
import { todayInParis } from '@/lib/rdvAvailability';
import VacationForm from './VacationForm';

export const dynamic = 'force-dynamic';

export default async function AdminVacancesPage() {
  const config = await getVacationConfig();
  const today = todayInParis();
  const phase = getVacationPhase(config, today);
  const hasRange = !!config.start && !!config.end && config.end >= config.start;

  let status: { tone: 'live' | 'off' | 'wait'; text: string };
  if (phase === 'during') status = { tone: 'live', text: '🟢 Le pop-up est actuellement affiché à tous les visiteurs (vacances en cours).' };
  else if (phase === 'before') status = { tone: 'live', text: '🟢 Le pop-up est actuellement affiché à tous les visiteurs (préavis avant le départ).' };
  else if (!config.enabled) status = { tone: 'off', text: '⚪ Mode vacances désactivé : les visiteurs ne voient rien.' };
  else if (hasRange && today > config.end) status = { tone: 'off', text: '⚪ Les vacances sont terminées : les visiteurs ne voient plus rien.' };
  else status = { tone: 'wait', text: `🟡 Activé, en attente : le pop-up s'affichera automatiquement (${formatRange(config.start, config.end)}).` };

  const tones = { live: 'bg-green-50 border-green-200 text-green-800', off: 'bg-gray-50 border-gray-200 text-gray-600', wait: 'bg-amber-50 border-amber-200 text-amber-800' };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">🏖️ Mode vacances</h1>
      <p className="text-sm text-gray-600 mb-4 max-w-3xl">
        Prépare ton pop-up de vacances et vérifie-le dans l&apos;aperçu en direct (visible par toi seul, il se met à jour pendant que tu écris), puis active-le. Il
        s&apos;affiche tout seul à la date de départ et disparaît tout seul après la date de retour.
      </p>
      <p className={`text-sm border rounded-lg px-3 py-2 mb-6 max-w-3xl ${tones[status.tone]}`}>{status.text}</p>
      <VacationForm initial={config} today={today} />
    </div>
  );
}
