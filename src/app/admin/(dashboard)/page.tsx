import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { formatPrice } from '@/lib/format';

export default async function AdminDashboardPage() {
  const [productsCount, outOfStockCount, pendingOrders, newPaidOrders, pendingAppointments, unhandledMessages, revenueAgg] =
    await Promise.all([
      prisma.product.count(),
      prisma.product.count({ where: { inStock: false } }),
      // Paniers non finalisés (paiement pas encore terminé) — relancés automatiquement par email,
      // pas des commandes reçues. Voir "Commandes payées à traiter" ci-dessous pour les vraies
      // nouvelles commandes qui attendent d'être préparées/expédiées.
      prisma.order.count({ where: { status: 'PENDING' } }),
      prisma.order.count({ where: { status: 'PAID' } }),
      prisma.appointment.count({ where: { status: 'REQUESTED' } }),
      prisma.contactMessage.count({ where: { handled: false } }),
      prisma.order.aggregate({
        where: { status: { in: ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'] } },
        _sum: { total: true },
      }),
    ]);

  const totalRevenue = Number(revenueAgg._sum.total ?? 0);

  const cards = [
    { label: 'Chiffre d\'affaires total', value: formatPrice(totalRevenue), href: '/admin/statistiques', accent: 'bg-green-50 text-green-700' },
    { label: 'Produits au catalogue', value: productsCount, href: '/admin/produits', accent: 'bg-blue-50 text-blue-700' },
    { label: 'Ruptures de stock', value: outOfStockCount, href: '/admin/produits?stock=rupture', accent: 'bg-red-50 text-red-700' },
    { label: 'Commandes payées à traiter', value: newPaidOrders, href: '/admin/commandes?statut=PAID', accent: 'bg-blue-50 text-blue-700' },
    { label: 'Paniers non finalisés', value: pendingOrders, href: '/admin/commandes?statut=PENDING', accent: 'bg-amber-50 text-amber-700' },
    { label: 'RDV à confirmer', value: pendingAppointments, href: '/admin/rdv', accent: 'bg-purple-50 text-purple-700' },
    { label: 'Messages non traités', value: unhandledMessages, href: '/admin/messages', accent: 'bg-green-50 text-green-700' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Tableau de bord</h1>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="bg-white border border-gray-100 rounded-xl p-5 hover:shadow-md transition"
          >
            <span className={`inline-block text-2xl font-extrabold px-2 py-1 rounded ${card.accent}`}>
              {card.value}
            </span>
            <p className="text-sm text-gray-600 mt-2">{card.label}</p>
          </Link>
        ))}
      </div>

      <div className="mt-8 bg-white border border-gray-100 rounded-xl p-5 text-sm text-gray-500">
        Astuce : les modifications de stock/prix sur un produit sont immédiates sur la boutique publique.
      </div>
    </div>
  );
}
