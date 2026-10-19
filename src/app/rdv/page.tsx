import { prisma } from '@/lib/prisma';
import { todayInParis } from '@/lib/rdvAvailability';
import RdvForm from './RdvForm';

// Les créneaux fermés se modifient depuis l'admin : la page doit toujours être lue à jour.
export const dynamic = 'force-dynamic';

export default async function RdvPage() {
  const today = todayInParis();
  const [zones, blocks] = await Promise.all([
    prisma.serviceZone.findMany({ orderBy: { extraFee: 'asc' } }),
    // Blocages à venir + blocages récurrents (chaque semaine)
    prisma.rdvBlock.findMany({ where: { OR: [{ date: { gte: today } }, { date: null }] } }),
  ]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-2">Prendre rendez-vous</h1>
      <p className="text-gray-600 mb-8">Réparation en atelier ou à domicile, sur Sainte-Maxime et le Golfe de Saint-Tropez.</p>

      <RdvForm
        zones={zones.map((z) => ({ cityName: z.cityName, extraFee: Number(z.extraFee) }))}
        blocks={blocks.map((b) => ({ date: b.date, weekday: b.weekday, period: b.period }))}
        today={today}
      />
    </div>
  );
}
