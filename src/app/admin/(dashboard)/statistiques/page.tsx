import { prisma } from '@/lib/prisma';
import { formatPrice } from '@/lib/format';

const VISIT_COUNTER_OFFSET = 21120;

// Statuts considérés comme du vrai chiffre d'affaires encaissé (une commande "En attente" n'est pas payée,
// une commande "Annulée"/"Remboursée" ne compte pas comme CA réalisé)
const REVENUE_STATUSES = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'] as const;

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente',
  PAID: 'Payée',
  PROCESSING: 'En préparation',
  SHIPPED: 'Expédiée',
  DELIVERED: 'Livrée',
  CANCELLED: 'Annulée',
  REFUNDED: 'Remboursée',
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function startOfYear(d: Date) {
  return new Date(d.getFullYear(), 0, 1);
}

export default async function AdminStatistiquesPage() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const sevenDaysAgo = new Date(todayStart.getTime() - 6 * 86_400_000);
  const thirtyDaysAgo = new Date(todayStart.getTime() - 29 * 86_400_000);
  const monthStart = startOfMonth(now);
  const yearStart = startOfYear(now);

  const revenueWhere = { status: { in: [...REVENUE_STATUSES] } };

  const [
    totalRevenueAgg,
    todayRevenueAgg,
    monthRevenueAgg,
    yearRevenueAgg,
    totalOrdersCount,
    allOrdersCount,
    statusBreakdownRaw,
    last12MonthsOrders,
    orderItemsForTopProducts,
    lastOrders,
  ] = await Promise.all([
    prisma.order.aggregate({ where: revenueWhere, _sum: { total: true } }),
    prisma.order.aggregate({ where: { ...revenueWhere, createdAt: { gte: todayStart } }, _sum: { total: true } }),
    prisma.order.aggregate({ where: { ...revenueWhere, createdAt: { gte: monthStart } }, _sum: { total: true } }),
    prisma.order.aggregate({ where: { ...revenueWhere, createdAt: { gte: yearStart } }, _sum: { total: true } }),
    prisma.order.count({ where: revenueWhere }),
    prisma.order.count(),
    prisma.order.groupBy({ by: ['status'], _count: { status: true } }),
    prisma.order.findMany({
      where: { ...revenueWhere, createdAt: { gte: new Date(now.getFullYear(), now.getMonth() - 11, 1) } },
      select: { createdAt: true, total: true },
    }),
    prisma.orderItem.findMany({
      where: { order: revenueWhere },
      select: { productId: true, quantity: true, unitPrice: true },
    }),
    prisma.order.findMany({
      where: revenueWhere,
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { id: true, customerName: true, total: true, status: true, createdAt: true, invoiceNumber: true },
    }),
  ]);

  const totalRevenue = Number(totalRevenueAgg._sum?.total ?? 0);
  const todayRevenue = Number(todayRevenueAgg._sum?.total ?? 0);
  const monthRevenue = Number(monthRevenueAgg._sum?.total ?? 0);
  const yearRevenue = Number(yearRevenueAgg._sum?.total ?? 0);
  const avgOrderValue = totalOrdersCount > 0 ? totalRevenue / totalOrdersCount : 0;

  // Chiffre d'affaires par mois, 12 derniers mois
  const monthBuckets: Record<string, number> = {};
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthBuckets[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`] = 0;
  }
  for (const o of last12MonthsOrders) {
    const key = `${o.createdAt.getFullYear()}-${String(o.createdAt.getMonth() + 1).padStart(2, '0')}`;
    if (key in monthBuckets) monthBuckets[key] += Number(o.total);
  }
  const maxMonth = Math.max(1, ...Object.values(monthBuckets));

  // Chiffre d'affaires par produit, calculé correctement (quantité × prix unitaire) en mémoire
  const revenueByProduct = new Map<string, { quantity: number; revenue: number }>();
  for (const item of orderItemsForTopProducts) {
    const existing = revenueByProduct.get(item.productId) ?? { quantity: 0, revenue: 0 };
    existing.quantity += item.quantity;
    existing.revenue += item.quantity * Number(item.unitPrice);
    revenueByProduct.set(item.productId, existing);
  }
  const topProductIds = [...revenueByProduct.entries()]
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 10)
    .map(([id]) => id);
  const topProductsInfo = await prisma.product.findMany({
    where: { id: { in: topProductIds } },
    select: { id: true, title: true },
  });
  const topProducts = topProductIds.map((id) => ({
    title: topProductsInfo.find((i) => i.id === id)?.title ?? 'Produit supprimé',
    quantity: revenueByProduct.get(id)!.quantity,
    revenue: revenueByProduct.get(id)!.revenue,
  }));

  const statusBreakdown = statusBreakdownRaw.map((s) => ({ status: s.status, count: s._count.status }));

  const [totalViews, todayViews, last7Views, last30Views, topPagesRaw, last7Raw] = await Promise.all([
    prisma.pageView.count(),
    prisma.pageView.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.pageView.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.pageView.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.pageView.groupBy({
      by: ['path'],
      _count: { path: true },
      orderBy: { _count: { path: 'desc' } },
      take: 10,
    }),
    prisma.pageView.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      select: { createdAt: true },
    }),
  ]);

  // Répartition par jour sur les 7 derniers jours (calculée en mémoire, table légère)
  const dayBuckets: Record<string, number> = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(sevenDaysAgo.getTime() + i * 86_400_000);
    dayBuckets[d.toISOString().slice(0, 10)] = 0;
  }
  for (const v of last7Raw) {
    const key = v.createdAt.toISOString().slice(0, 10);
    if (key in dayBuckets) dayBuckets[key]++;
  }
  const maxDay = Math.max(1, ...Object.values(dayBuckets));

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold">Statistiques</h1>
        <a href="/api/export/statistiques" className="text-sm bg-gray-800 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 transition">
          ⬇️ Exporter CSV
        </a>
      </div>
      <p className="text-gray-500 mb-6">
        Chiffre d&apos;affaires calculé sur les commandes payées, en préparation, expédiées ou livrées — les
        commandes en attente de paiement, annulées ou remboursées ne sont pas comptées comme du CA encaissé.
      </p>

      <h2 className="text-lg font-bold mb-3">💰 Chiffre d&apos;affaires</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total (historique complet)" value={formatPrice(totalRevenue)} highlight />
        <StatCard label="Aujourd'hui" value={formatPrice(todayRevenue)} />
        <StatCard label="Ce mois-ci" value={formatPrice(monthRevenue)} />
        <StatCard label="Cette année" value={formatPrice(yearRevenue)} />
      </div>

      <h2 className="text-lg font-bold mb-3">🧾 Commandes</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Commandes payées (total)" value={totalOrdersCount.toLocaleString('fr-FR')} highlight />
        <StatCard label="Toutes commandes confondues" value={allOrdersCount.toLocaleString('fr-FR')} />
        <StatCard label="Panier moyen" value={formatPrice(avgOrderValue)} />
        <StatCard
          label="Taux de conversion paiement"
          value={allOrdersCount > 0 ? `${Math.round((totalOrdersCount / allOrdersCount) * 100)}%` : '—'}
        />
      </div>

      <div className="bg-white border border-gray-100 rounded-xl p-6 mb-6">
        <h2 className="font-semibold mb-4">Chiffre d&apos;affaires — 12 derniers mois</h2>
        <div className="flex items-end gap-2 h-40">
          {Object.entries(monthBuckets).map(([month, revenue]) => (
            <div key={month} className="flex-1 flex flex-col items-center justify-end h-full">
              <span className="text-[9px] text-gray-500 mb-1 whitespace-nowrap">
                {revenue > 0 ? formatPrice(revenue) : ''}
              </span>
              <div
                className="w-full bg-green-600 rounded-t"
                style={{ height: `${Math.max(2, (revenue / maxMonth) * 100)}%` }}
              />
              <span className="text-[10px] text-gray-400 mt-1">
                {new Date(`${month}-01`).toLocaleDateString('fr-FR', { month: 'short' })}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <h2 className="font-semibold p-5 pb-3">Répartition des commandes par statut</h2>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-100">
              {statusBreakdown.map((s) => (
                <tr key={s.status}>
                  <td className="px-5 py-2 text-gray-700">{STATUS_LABELS[s.status] ?? s.status}</td>
                  <td className="px-5 py-2 text-right font-medium">{s.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <h2 className="font-semibold p-5 pb-3">Produits les plus vendus (par CA)</h2>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-100">
              {topProducts.length === 0 ? (
                <tr>
                  <td className="px-5 py-4 text-gray-400" colSpan={3}>Pas encore de données.</td>
                </tr>
              ) : (
                topProducts.map((p, i) => (
                  <tr key={i}>
                    <td className="px-5 py-2 text-gray-700 truncate max-w-[160px]">{p.title}</td>
                    <td className="px-5 py-2 text-gray-400 text-xs">{p.quantity} vendu(s)</td>
                    <td className="px-5 py-2 text-right font-medium">{formatPrice(p.revenue)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden mb-10">
        <div className="flex items-center justify-between p-5 pb-3">
          <h2 className="font-semibold">Dernières commandes payées</h2>
          <a href="/admin/commandes" className="text-brand text-sm hover:underline">Voir toutes les commandes →</a>
        </div>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-gray-100">
            {lastOrders.map((o) => (
              <tr key={o.id}>
                <td className="px-5 py-2 text-gray-400">
                  {o.createdAt.toLocaleDateString('fr-FR')}
                </td>
                <td className="px-5 py-2 text-gray-700">{o.customerName}</td>
                <td className="px-5 py-2 text-gray-500">{STATUS_LABELS[o.status] ?? o.status}</td>
                <td className="px-5 py-2 text-right font-medium">{formatPrice(Number(o.total))}</td>
              </tr>
            ))}
            {lastOrders.length === 0 && (
              <tr>
                <td className="px-5 py-4 text-gray-400" colSpan={4}>Pas encore de commande payée.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="text-lg font-bold mb-3">👀 Visites du site</h2>
      <p className="text-gray-500 mb-4 text-sm">
        Compteur affiché sur la page d&apos;accueil : base de départ {VISIT_COUNTER_OFFSET.toLocaleString('fr-FR')}{' '}
        + visites réelles enregistrées depuis la mise en ligne de ce compteur.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Compteur affiché" value={(VISIT_COUNTER_OFFSET + totalViews).toLocaleString('fr-FR')} highlight />
        <StatCard label="Aujourd'hui" value={todayViews.toLocaleString('fr-FR')} />
        <StatCard label="7 derniers jours" value={last7Views.toLocaleString('fr-FR')} />
        <StatCard label="30 derniers jours" value={last30Views.toLocaleString('fr-FR')} />
      </div>

      <div className="bg-white border border-gray-100 rounded-xl p-6 mb-6">
        <h2 className="font-semibold mb-4">Visites — 7 derniers jours</h2>
        <div className="flex items-end gap-3 h-40">
          {Object.entries(dayBuckets).map(([day, count]) => (
            <div key={day} className="flex-1 flex flex-col items-center justify-end h-full">
              <span className="text-xs text-gray-500 mb-1">{count}</span>
              <div
                className="w-full bg-brand rounded-t"
                style={{ height: `${Math.max(4, (count / maxDay) * 100)}%` }}
              />
              <span className="text-[10px] text-gray-400 mt-1">
                {new Date(day).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <h2 className="font-semibold p-6 pb-3">Pages les plus visitées (total)</h2>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-gray-100">
            {topPagesRaw.map((p) => (
              <tr key={p.path}>
                <td className="px-6 py-2.5 text-gray-700">{p.path}</td>
                <td className="px-6 py-2.5 text-right font-medium">{p._count.path.toLocaleString('fr-FR')}</td>
              </tr>
            ))}
            {topPagesRaw.length === 0 && (
              <tr>
                <td className="px-6 py-4 text-gray-400" colSpan={2}>Pas encore de données.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-5 border ${highlight ? 'bg-brand text-white border-brand' : 'bg-white border-gray-100'}`}>
      <p className={`text-xs ${highlight ? 'text-white/80' : 'text-gray-400'}`}>{label}</p>
      <p className="text-2xl font-extrabold mt-1">{value}</p>
    </div>
  );
}
