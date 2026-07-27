import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendPendingOrderReminder } from '@/lib/orderReminder';

// Appelée périodiquement par Vercel Cron (voir vercel.json) — protégée par CRON_SECRET.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  // Commandes en attente depuis plus d'1h, jamais relancées
  const staleOrders = await prisma.order.findMany({
    where: { status: 'PENDING', createdAt: { lte: oneHourAgo }, reminderSentAt: null },
    select: { id: true },
    take: 50, // par sécurité, on limite le nombre d'envois par exécution
  });

  let sent = 0;
  for (const order of staleOrders) {
    const result = await sendPendingOrderReminder(order.id);
    if (result.ok) sent++;
  }

  return NextResponse.json({ checked: staleOrders.length, sent });
}
