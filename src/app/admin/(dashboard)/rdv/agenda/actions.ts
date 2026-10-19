'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdminUser } from '@/lib/supabase-server';
import { syncAppointmentToCalendar, testCalendarConnection } from '@/lib/googleCalendar';
import { todayInParis } from '@/lib/rdvAvailability';

async function setSetting(key: string, value: string) {
  await prisma.siteSetting.upsert({ where: { key }, update: { value }, create: { key, value } });
}

export async function saveCalendarSettings(calendarId: string, enabled: boolean) {
  await requireAdminUser();
  const id = calendarId.trim();
  if (enabled && !id) return { error: "Indique d'abord l'identifiant de ton agenda (ton adresse Gmail)." };
  await setSetting('gcal_calendar_id', id);
  await setSetting('gcal_enabled', String(enabled));
  revalidatePath('/admin/rdv/agenda');
  return { ok: true };
}

export async function testCalendar(calendarId: string) {
  await requireAdminUser();
  if (!calendarId.trim()) return { error: "Indique d'abord l'identifiant de ton agenda." };
  return testCalendarConnection(calendarId.trim());
}

// Envoie dans l'agenda les RDV à venir qui n'y sont pas encore (demandes reçues avant l'activation).
export async function syncUpcomingAppointments() {
  await requireAdminUser();
  const pending = await prisma.appointment.findMany({
    where: {
      status: { not: 'CANCELLED' },
      googleEventId: null,
      preferredDate: { gte: new Date(`${todayInParis()}T00:00`) },
    },
    select: { id: true },
    orderBy: { preferredDate: 'asc' },
    take: 50,
  });
  let sent = 0;
  let lastError: string | undefined;
  for (const a of pending) {
    const r = await syncAppointmentToCalendar(a.id);
    if (r.ok) sent++;
    else if (r.error) lastError = r.error;
  }
  revalidatePath('/admin/rdv/agenda');
  return { sent, total: pending.length, error: sent === 0 && lastError ? lastError : undefined };
}
