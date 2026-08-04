import { NextRequest } from 'next/server';
import { requireAdminUser } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';
import { toCsv, csvResponse } from '@/lib/csv';
import type { AppointmentStatus, AppointmentType, Prisma } from '@prisma/client';

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  REQUESTED: 'Demandé',
  CONFIRMED: 'Confirmé',
  DONE: 'Terminé',
  CANCELLED: 'Annulé',
};

export async function GET(req: NextRequest) {
  await requireAdminUser();

  const { searchParams } = req.nextUrl;
  const where: Prisma.AppointmentWhereInput = {};

  const statut = searchParams.get('statut');
  const type = searchParams.get('type');
  const ville = searchParams.get('ville');
  const du = searchParams.get('du');
  const au = searchParams.get('au');
  const q = searchParams.get('q');

  if (statut) where.status = statut as AppointmentStatus;
  if (type) where.type = type as AppointmentType;
  if (ville) where.city = ville;
  if (du || au) {
    where.preferredDate = {
      ...(du ? { gte: new Date(du) } : {}),
      ...(au ? { lte: new Date(`${au}T23:59:59`) } : {}),
    };
  }
  if (q) {
    where.OR = [
      { customerName: { contains: q, mode: 'insensitive' } },
      { customerEmail: { contains: q, mode: 'insensitive' } },
      { deviceModel: { contains: q, mode: 'insensitive' } },
    ];
  }

  const appointments = await prisma.appointment.findMany({ where, orderBy: { preferredDate: 'asc' } });

  const rows = appointments.map((a) => [
    a.customerName,
    a.customerEmail,
    a.customerPhone,
    `${a.deviceBrand} ${a.deviceModel}`,
    a.issueDescription.replace(/\s+/g, ' ').trim(),
    a.type === 'DOMICILE' ? 'Domicile' : 'Atelier',
    a.city,
    Number(a.extraFee).toFixed(2),
    a.latitude && a.longitude ? `https://www.google.com/maps?q=${a.latitude},${a.longitude}` : '',
    new Date(a.preferredDate).toLocaleString('fr-FR'),
    STATUS_LABELS[a.status],
    a.createdAt.toLocaleString('fr-FR'),
  ]);

  const csv = toCsv(
    ['Nom', 'Email', 'Téléphone', 'Appareil', 'Description', 'Type', 'Ville', 'Frais déplacement', 'Position GPS', 'Date souhaitée', 'Statut', 'Date de la demande'],
    rows
  );

  return csvResponse(csv, `rendez-vous-reparmonphone-${new Date().toISOString().slice(0, 10)}.csv`);
}
