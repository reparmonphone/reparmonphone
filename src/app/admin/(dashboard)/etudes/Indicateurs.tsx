import { prisma } from '@/lib/prisma';

// Statuts considérés comme de vraies commandes (même définition que /admin/statistiques)
const REVENUE_STATUSES = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'] as const;
const DAY = 24 * 60 * 60 * 1000;

// « Mesurer pour savoir si ça marche » (étude MiroFish n°1) : 4 chiffres à regarder chaque mois.
export default async function Indicateurs() {
  const now = Date.now();
  const since30 = new Date(now - 30 * DAY);
  const since90 = new Date(now - 90 * DAY);

  const [totalProducts, outOfStock, delivered, productViews, orders30, buyers] = await Promise.all([
    prisma.product.count({ where: { showInBoutique: true } }),
    prisma.product.count({ where: { showInBoutique: true, inStock: false } }),
    prisma.order.findMany({
      where: { deliveredAt: { gte: since90 } },
      select: { createdAt: true, deliveredAt: true },
    }),
    prisma.pageView.count({ where: { path: { startsWith: '/produit/' }, createdAt: { gte: since30 } } }),
    prisma.order.count({ where: { status: { in: [...REVENUE_STATUSES] }, createdAt: { gte: since30 } } }),
    prisma.order.groupBy({
      by: ['customerEmail'],
      where: { status: { in: [...REVENUE_STATUSES] } },
      _count: { _all: true },
    }),
  ]);

  const ruptureRate = totalProducts > 0 ? (outOfStock / totalProducts) * 100 : null;

  const delays = delivered
    .filter((o: { createdAt: Date; deliveredAt: Date | null }) => o.deliveredAt)
    .map((o: { createdAt: Date; deliveredAt: Date | null }) => (o.deliveredAt!.getTime() - o.createdAt.getTime()) / DAY);
  const avgDelay = delays.length > 0 ? delays.reduce((a: number, b: number) => a + b, 0) / delays.length : null;

  const conversion = productViews > 0 ? (orders30 / productViews) * 100 : null;

  const repeatBuyers = buyers.filter((b: { _count: { _all: number } }) => b._count._all >= 2).length;
  const repeatRate = buyers.length > 0 ? (repeatBuyers / buyers.length) * 100 : null;

  const fmt = (n: number, digits = 1) => n.toFixed(digits).replace('.', ',');

  const tiles = [
    {
      label: 'Produits en rupture',
      value: ruptureRate == null ? '—' : `${fmt(ruptureRate)} %`,
      sub: `${outOfStock} sur ${totalProducts} produits de la boutique. Objectif : le plus bas possible.`,
    },
    {
      label: 'Délai commande → livrée',
      value: avgDelay == null ? '—' : `${fmt(avgDelay)} j`,
      sub:
        delays.length > 0
          ? `Moyenne sur ${delays.length} commande(s) livrée(s) ces 90 jours.`
          : 'Aucune commande marquée « Livrée » ces 90 jours : pense à les passer en Livrée.',
    },
    {
      label: 'Conversion fiche → commande',
      value: conversion == null ? '—' : `${fmt(conversion)} %`,
      sub: `${orders30} commande(s) pour ${productViews} vue(s) de fiches produit sur 30 jours.`,
    },
    {
      label: 'Clients qui rachètent',
      value: repeatRate == null ? '—' : `${fmt(repeatRate, 0)} %`,
      sub: `${repeatBuyers} client(s) sur ${buyers.length} ont commandé au moins 2 fois.`,
    },
  ];

  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold mb-1">📏 Indicateurs à suivre chaque mois</h2>
      <p className="text-sm text-gray-500 mb-3">Calculés en direct à partir de tes commandes, de ton stock et de tes visites.</p>
      <div className="grid sm:grid-cols-2 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className="bg-white border border-gray-100 rounded-xl p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{t.value}</p>
            <p className="text-xs text-gray-500 mt-1">{t.sub}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
