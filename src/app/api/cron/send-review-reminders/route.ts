import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendReviewReminder } from '@/lib/reviewReminder';

// Appelée périodiquement par Vercel Cron (voir vercel.json) — protégée par CRON_SECRET.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);

  const staleOrders = await prisma.order.findMany({
    where: { status: 'DELIVERED', deliveredAt: { lte: tenDaysAgo }, reviewReminderSentAt: null },
    select: { id: true },
    take: 50,
  });

  let sent = 0;
  for (const order of staleOrders) {
    const result = await sendReviewReminder(order.id);
    if (result.ok) sent++;
  }

  return NextResponse.json({ checked: staleOrders.length, sent });
}
