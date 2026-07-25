import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { formatPrice } from '@/lib/format';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente',
  PAID: 'Payée',
  PROCESSING: 'En préparation',
  SHIPPED: 'Expédiée',
  DELIVERED: 'Livrée',
  CANCELLED: 'Annulée',
  REFUNDED: 'Remboursée',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  PAID: 'bg-blue-100 text-blue-700',
  PROCESSING: 'bg-purple-100 text-purple-700',
  SHIPPED: 'bg-indigo-100 text-indigo-700',
  DELIVERED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-gray-200 text-gray-600',
  REFUNDED: 'bg-red-100 text-red-700',
};

export default async function AdminCommandesPage() {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { items: true },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Commandes</h1>

      {orders.length === 0 ? (
        <p className="text-gray-500">Aucune commande pour le moment.</p>
      ) : (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Articles</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800">{o.customerName}</div>
                    <div className="text-gray-500 text-xs">{o.customerEmail}</div>
                  </td>
                  <td className="px-4 py-3">{o.items.length}</td>
                  <td className="px-4 py-3 font-medium">{formatPrice(Number(o.total))}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[o.status]}`}>
                      {STATUS_LABELS[o.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(o.createdAt).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/commandes/${o.id}`} className="text-brand hover:underline">
                      Détail
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
