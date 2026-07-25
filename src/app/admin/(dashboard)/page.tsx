import Link from 'next/link';
import { prisma } from '@/lib/prisma';

export default async function AdminDashboardPage() {
  const [productsCount, outOfStockCount, pendingOrders, pendingAppointments, unhandledMessages] =
    await Promise.all([
      prisma.product.count(),
      prisma.product.count({ where: { inStock: false } }),
      prisma.order.count({ where: { status: 'PENDING' } }),
      prisma.appointment.count({ where: { status: 'REQUESTED' } }),
      prisma.contactMessage.count({ where: { handled: false } }),
    ]);

  const cards = [
    { label: 'Produits au catalogue', value: productsCount, href: '/admin/produits', accent: 'bg-blue-50 text-blue-700' },
    { label: 'Ruptures de stock', value: outOfStockCount, href: '/admin/produits?stock=rupture', accent: 'bg-red-50 text-red-700' },
    { label: 'Commandes en attente', value: pendingOrders, href: '/admin/commandes', accent: 'bg-amber-50 text-amber-700' },
    { label: 'RDV à confirmer', value: pendingAppointments, href: '/admin/rdv', accent: 'bg-purple-50 text-purple-700' },
    { label: 'Messages non traités', value: unhandledMessages, href: '/admin/messages', accent: 'bg-green-50 text-green-700' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Tableau de bord</h1>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
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
