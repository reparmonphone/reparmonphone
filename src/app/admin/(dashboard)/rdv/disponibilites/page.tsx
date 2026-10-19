import { prisma } from '@/lib/prisma';
import { todayInParis } from '@/lib/rdvAvailability';
import RdvTabs from '../RdvTabs';
import AvailabilityManager from './AvailabilityManager';

export const dynamic = 'force-dynamic';

export default async function AdminRdvDisponibilitesPage() {
  const today = todayInParis();
  const blocks = await prisma.rdvBlock.findMany({
    where: { OR: [{ date: { gte: today } }, { date: null }] },
    orderBy: [{ date: 'asc' }, { weekday: 'asc' }],
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Rendez-vous</h1>
      <RdvTabs active="disponibilites" />
      <AvailabilityManager
        today={today}
        blocks={blocks.map((b) => ({ id: b.id, date: b.date, weekday: b.weekday, period: b.period, note: b.note }))}
      />
    </div>
  );
}
