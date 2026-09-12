import Link from 'next/link';
import { prisma } from '@/lib/prisma';

// Vue d'ensemble de toutes les inscriptions "Alerte Stock" en attente, tous produits confondus,
// triée du produit le plus demandé au moins demandé — c'est cette liste qui indique le plus
// simplement chez quel produit il est prioritaire de vérifier la disponibilité fournisseur.
export default async function AdminStockAlertsPage() {
  const notifications = await prisma.stockNotification.findMany({
    where: { notifiedAt: null },
    include: { product: { select: { id: true, title: true, slug: true, inStock: true } } },
    orderBy: { createdAt: 'asc' },
  });

  const byProduct = new Map<
    string,
    { product: (typeof notifications)[number]['product']; emails: string[] }
  >();
  for (const n of notifications) {
    const entry = byProduct.get(n.productId) ?? { product: n.product, emails: [] };
    entry.emails.push(n.email);
    byProduct.set(n.productId, entry);
  }
  const rows = Array.from(byProduct.values()).sort((a, b) => b.emails.length - a.emails.length);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">🔔 Alertes stock</h1>
      <p className="text-gray-500 mb-6">
        Clients inscrits pour être prévenus quand un produit en rupture revient en stock. Dès que tu repasses un
        produit "Produit disponible à la vente" (ici via "Modifier", ou directement depuis la liste{' '}
        <Link href="/admin/produits" className="text-brand hover:underline">Produits &amp; stock</Link>), tout le
        monde ci-dessous reçoit automatiquement un email avec le lien du produit.
      </p>

      {rows.length === 0 ? (
        <p className="text-gray-400">Aucune inscription en attente pour le moment.</p>
      ) : (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-3">Produit</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">En attente</th>
                <th className="px-4 py-3">Emails inscrits</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(({ product, emails }) => (
                <tr key={product.id} className="hover:bg-gray-50 align-top">
                  <td className="px-4 py-3 font-medium text-gray-800 max-w-[220px] truncate">{product.title}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        product.inStock ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {product.inStock ? 'En stock' : 'Rupture'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-800">{emails.length}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-[320px]">{emails.join(', ')}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Link href={`/admin/produits/${product.id}`} className="text-brand hover:underline">
                      Modifier
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
