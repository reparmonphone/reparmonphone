import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import NewCollectionForm from './NewCollectionForm';

export default async function AdminCollectionsPage() {
  const collections = await prisma.collection.findMany({ orderBy: { name: 'asc' } });

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-1">Collections</h1>
      <p className="text-gray-500 mb-6">
        Regroupe des modèles choisis à la main (peu importe leur marque/gamme) pour créer une page dédiée — ex.
        "Reconditionnés", "Promo été"... Relie ensuite un lien du <Link href="/admin/menu" className="text-brand hover:underline">menu du header</Link> vers
        <code className="mx-1 bg-gray-100 px-1.5 py-0.5 rounded text-xs">/collection/ton-slug</code>.
      </p>

      <div className="bg-white border border-gray-100 rounded-xl divide-y divide-gray-100 mb-6">
        {collections.length === 0 ? (
          <p className="p-5 text-gray-500 text-sm">Aucune collection pour le moment.</p>
        ) : (
          collections.map((c) => (
            <div key={c.id} className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{c.name}</p>
                <p className="text-xs text-gray-400">
                  /collection/{c.slug} — {c.productIds.length} produit(s) sélectionné(s)
                </p>
              </div>
              <Link href={`/admin/collections/${c.id}`} className="text-brand text-sm hover:underline">
                Gérer les produits
              </Link>
            </div>
          ))
        )}
      </div>

      <div className="bg-white border border-gray-100 rounded-xl p-5">
        <h2 className="font-semibold mb-3">Créer une collection</h2>
        <NewCollectionForm />
      </div>
    </div>
  );
}
