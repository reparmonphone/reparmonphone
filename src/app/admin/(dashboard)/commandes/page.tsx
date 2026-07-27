import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { formatPrice } from '@/lib/format';
import { CARRIER_LABELS } from '@/lib/tracking';
import OrderRowActions from './OrderRowActions';

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

function paymentLabel(o: { paymentProvider: string; paymentBrand: string | null; paymentLast4: string | null }) {
  if (o.paymentProvider === 'SUMUP') return '💳 SumUp';
  if (o.paymentProvider === 'PAYPAL') return 'PayPal';
  // Stripe
  if (o.paymentBrand) {
    return `💳 ${o.paymentBrand.toUpperCase()}${o.paymentLast4 ? ` •••${o.paymentLast4}` : ''}`;
  }
  return '💳 Stripe';
}

export default async function AdminCommandesPage({
  searchParams,
}: {
  searchParams: { statut?: string; q?: string };
}) {
  const where: Record<string, unknown> = {};
  if (searchParams.statut) where.status = searchParams.statut;
  if (searchParams.q) {
    where.OR = [
      { customerName: { contains: searchParams.q, mode: 'insensitive' } },
      { customerEmail: { contains: searchParams.q, mode: 'insensitive' } },
    ];
  }

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 150,
    include: { items: true },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Commandes</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{orders.length} commande(s)</span>
          <a href="/api/export/commandes" className="text-sm bg-gray-800 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 transition">
            ⬇️ Exporter CSV
          </a>
        </div>
      </div>

      <form className="flex flex-wrap gap-3 mb-6" action="/admin/commandes" method="get">
        <input
          type="text"
          name="q"
          defaultValue={searchParams.q}
          placeholder="Rechercher un client ou un email..."
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1 min-w-[220px]"
        />
        <select name="statut" defaultValue={searchParams.statut ?? ''} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
          <option value="">Tous les statuts</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <button type="submit" className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-dark transition">
          Filtrer
        </button>
        {(searchParams.statut || searchParams.q) && (
          <Link href="/admin/commandes" className="text-sm text-gray-500 hover:text-gray-800 self-center">
            Réinitialiser
          </Link>
        )}
      </form>

      {orders.length === 0 ? (
        <p className="text-gray-500">Aucune commande ne correspond.</p>
      ) : (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Articles</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Paiement</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Suivi</th>
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
                  <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{paymentLabel(o)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[o.status]}`}>
                      {STATUS_LABELS[o.status]}
                    </span>
                    {o.status === 'PENDING' && o.reminderSentAt && (
                      <p className="text-[10px] text-gray-400 mt-1">
                        Relancé le {new Date(o.reminderSentAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {o.carrier && o.trackingNumber ? (
                      <span className="text-green-700">{CARRIER_LABELS[o.carrier]}</span>
                    ) : (
                      <span className="text-gray-400">Non renseigné</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {new Date(o.createdAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td className="px-4 py-3">
                    <OrderRowActions orderId={o.id} isPending={o.status === 'PENDING'} />
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
