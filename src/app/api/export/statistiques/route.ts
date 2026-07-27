import { requireAdminUser } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';
import { toCsv, csvResponse } from '@/lib/csv';

const REVENUE_STATUSES = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'] as const;

export async function GET() {
  await requireAdminUser();

  const now = new Date();
  const orders = await prisma.order.findMany({
    where: { status: { in: REVENUE_STATUSES }, createdAt: { gte: new Date(now.getFullYear(), now.getMonth() - 23, 1) } },
    select: { createdAt: true, total: true },
  });

  const monthBuckets = new Map<string, { revenue: number; count: number }>();
  for (const o of orders) {
    const key = `${o.createdAt.getFullYear()}-${String(o.createdAt.getMonth() + 1).padStart(2, '0')}`;
    const existing = monthBuckets.get(key) ?? { revenue: 0, count: 0 };
    existing.revenue += Number(o.total);
    existing.count += 1;
    monthBuckets.set(key, existing);
  }

  const rows = [...monthBuckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, { revenue, count }]) => [month, revenue.toFixed(2), count, (revenue / count).toFixed(2)]);

  const csv = toCsv(['Mois', 'Chiffre d\u2019affaires', 'Nb commandes', 'Panier moyen'], rows);

  return csvResponse(csv, `statistiques-reparmonphone-${new Date().toISOString().slice(0, 10)}.csv`);
}
