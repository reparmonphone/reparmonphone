import { prisma } from '@/lib/prisma';
import { getGcalSettings, getServiceAccount } from '@/lib/googleCalendar';
import { todayInParis } from '@/lib/rdvAvailability';
import RdvTabs from '../RdvTabs';
import AgendaSettings from './AgendaSettings';

export const dynamic = 'force-dynamic';

export default async function AdminRdvAgendaPage() {
  const settings = await getGcalSettings();
  const account = getServiceAccount();
  const notInCalendar = await prisma.appointment.count({
    where: {
      status: { not: 'CANCELLED' },
      googleEventId: null,
      preferredDate: { gte: new Date(`${todayInParis()}T00:00`) },
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Rendez-vous</h1>
      <RdvTabs active="agenda" />
      <AgendaSettings
        initialCalendarId={settings.calendarId}
        initialEnabled={settings.enabled}
        credentialsOk={account.configured}
        serviceAccountEmail={account.email}
        notInCalendar={notInCalendar}
      />
    </div>
  );
}
