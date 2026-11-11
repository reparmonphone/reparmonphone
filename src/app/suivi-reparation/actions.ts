'use server';

import { prisma } from '@/lib/prisma';

// « Suivre ma réparation » : le client saisit son e-mail ET son téléphone (les deux doivent correspondre
// à ceux de sa demande). On ne renvoie que l'avancement et le nom de l'appareil, jamais de coordonnées.

export type RepairStatusResult = {
  id: string;
  kind: 'ATELIER' | 'DOMICILE' | 'CORRESPONDANCE';
  device: string;
  date: string; // ISO
  // Rendez-vous : REQUESTED | CONFIRMED | DONE | CANCELLED ; correspondance : MailInRepairStatus
  status: string;
};

const digits = (s: string) => s.replace(/\D+/g, '');
const samePhone = (a: string, b: string) => {
  const x = digits(a).slice(-9);
  const y = digits(b).slice(-9);
  return x.length === 9 && x === y;
};

export async function lookupRepairs(
  email: string,
  phone: string,
): Promise<{ ok: true; results: RepairStatusResult[] } | { ok: false; error: string }> {
  const mail = String(email ?? '').trim().toLowerCase().slice(0, 200);
  const tel = String(phone ?? '').slice(0, 40);
  if (!mail.includes('@') || digits(tel).length < 9) {
    return { ok: false, error: 'Merci de saisir votre e-mail et votre numéro de téléphone complets.' };
  }

  try {
    const [appointments, mailIns] = await Promise.all([
      prisma.appointment.findMany({
        where: { customerEmail: { equals: mail, mode: 'insensitive' } },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          type: true,
          deviceBrand: true,
          deviceModel: true,
          preferredDate: true,
          status: true,
          customerPhone: true,
        },
      }),
      prisma.mailInRepair.findMany({
        where: { customerEmail: { equals: mail, mode: 'insensitive' } },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          deviceBrand: true,
          deviceModel: true,
          createdAt: true,
          status: true,
          customerPhone: true,
        },
      }),
    ]);

    const results: RepairStatusResult[] = [
      ...appointments
        .filter((a) => samePhone(a.customerPhone, tel))
        .map((a) => ({
          id: a.id,
          kind: a.type as 'ATELIER' | 'DOMICILE',
          device: `${a.deviceBrand} ${a.deviceModel}`.trim(),
          date: a.preferredDate.toISOString(),
          status: a.status as string,
        })),
      ...mailIns
        .filter((m) => samePhone(m.customerPhone, tel))
        .map((m) => ({
          id: m.id,
          kind: 'CORRESPONDANCE' as const,
          device: `${m.deviceBrand} ${m.deviceModel}`.trim(),
          date: m.createdAt.toISOString(),
          status: m.status as string,
        })),
    ]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 6);

    return { ok: true, results };
  } catch {
    return { ok: false, error: 'Service momentanément indisponible, réessayez dans un instant.' };
  }
}
