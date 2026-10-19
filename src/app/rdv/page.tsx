import { prisma } from '@/lib/prisma';
import { todayInParis } from '@/lib/rdvAvailability';
import { getVacationConfig } from '@/lib/vacation';
import { isValidRange } from '@/lib/vacationShared';
import RdvForm from './RdvForm';

// Les créneaux fermés se modifient depuis l'admin : la page doit toujours être lue à jour.
export const dynamic = 'force-dynamic';

export default async function RdvPage() {
  const today = todayInParis();
  const vacationConfig = await getVacationConfig();
  const vacation =
    vacationConfig.enabled && isValidRange(vacationConfig.start, vacationConfig.end) && vacationConfig.end >= today
      ? { start: vacationConfig.start, end: vacationConfig.end }
      : null;
  const [zones, blocks, confirmed] = await Promise.all([
    prisma.serviceZone.findMany({ orderBy: { extraFee: 'asc' } }),
    // Blocages à venir + blocages récurrents (chaque semaine)
    prisma.rdvBlock.findMany({ where: { OR: [{ date: { gte: today } }, { date: null }] } }),
    // RDV déjà acceptés (seulement date + heure, jamais de données client) pour signaler les heures prises
    prisma.appointment.findMany({
      where: { status: 'CONFIRMED', preferredDate: { gte: new Date(`${today}T00:00`) } },
      select: { preferredDate: true },
    }),
  ]);
  const booked = confirmed.map((a) => {
    const iso = a.preferredDate.toISOString(); // l'heure est enregistrée telle que saisie (voir /api/rdv)
    return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
  });

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-2">Prendre rendez-vous</h1>
      <p className="text-gray-600 mb-8">Réparation en atelier ou à domicile, sur Sainte-Maxime et le Golfe de Saint-Tropez.</p>

      <RdvForm
        zones={zones.map((z) => ({ cityName: z.cityName, extraFee: Number(z.extraFee) }))}
        blocks={blocks.map((b) => ({ date: b.date, weekday: b.weekday, period: b.period }))}
        booked={booked}
        vacation={vacation}
        today={today}
      />
    </div>
  );
}
