import Link from 'next/link';
import { prisma } from '@/lib/prisma';

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  OPEN: { label: '🔴 En attente', className: 'bg-red-100 text-red-700' },
  CREDIT_ISSUED: { label: '💳 Avoir accordé', className: 'bg-blue-100 text-blue-700' },
  REFUNDED: { label: '✅ Remboursé', className: 'bg-green-100 text-green-700' },
  REJECTED: { label: '❌ Refusé', className: 'bg-gray-100 text-gray-500' },
};

export default async function AdminLitigesPage() {
  const claims = await prisma.claim.findMany({
    orderBy: { createdAt: 'desc' },
    include: { order: true },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Litiges & réclamations</h1>

      {claims.length === 0 ? (
        <p className="text-gray-500">Aucun litige pour le moment.</p>
      ) : (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Commande</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {claims.map((c) => {
                const status = STATUS_LABELS[c.status];
                return (
                  <tr key={c.id} className="hover:bg-gray-50 align-top">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{c.order.customerName}</div>
                      <div className="text-gray-500 text-xs">{c.customerEmail}</div>
                    </td>
                    <td className="px-4 py-3">#{c.order.invoiceNumber || c.order.id.slice(-8)}</td>
                    <td className="px-4 py-3 max-w-xs truncate text-gray-600">{c.description}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.className}`}>{status.label}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{new Date(c.createdAt).toLocaleDateString('fr-FR')}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/admin/litiges/${c.id}`} className="text-brand hover:underline">Traiter</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
