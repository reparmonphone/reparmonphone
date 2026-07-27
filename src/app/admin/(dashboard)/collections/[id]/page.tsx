import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import CollectionProductPicker from './CollectionProductPicker';
import RenameCollectionForm from './RenameCollectionForm';
import DeleteCollectionButton from './DeleteCollectionButton';

export default async function AdminCollectionEditPage({ params }: { params: { id: string } }) {
  const [collection, products] = await Promise.all([
    prisma.collection.findUnique({ where: { id: params.id } }),
    prisma.product.findMany({
      select: {
        id: true,
        title: true,
        price: true,
        showInBoutique: true,
        model: { select: { name: true, productLine: { select: { name: true, brand: { select: { name: true } } } } } },
      },
      orderBy: { title: 'asc' },
    }),
  ]);

  if (!collection) notFound();

  return (
    <div className="max-w-4xl">
      <Link href="/admin/collections" className="text-sm text-gray-500 hover:text-gray-800">← Retour aux collections</Link>

      <div className="flex items-center justify-between mt-2 mb-1">
        <h1 className="text-2xl font-bold">{collection.name}</h1>
        <Link href={`/collection/${collection.slug}`} target="_blank" className="text-brand text-sm hover:underline">
          Voir la page publique →
        </Link>
      </div>
      <p className="text-gray-500 mb-6">
        /collection/{collection.slug} — {collection.productIds.length} produit(s) sélectionné(s)
      </p>

      <div className="bg-white border border-gray-100 rounded-xl p-5 mb-6 flex items-center justify-between gap-4">
        <RenameCollectionForm collectionId={collection.id} initialName={collection.name} />
        <DeleteCollectionButton collectionId={collection.id} />
      </div>

      <CollectionProductPicker
        collectionId={collection.id}
        initialProductIds={collection.productIds}
        products={products.map((p) => ({
          id: p.id,
          title: p.title,
          price: Number(p.price),
          showInBoutique: p.showInBoutique,
          brandName: p.model.productLine.brand.name,
          lineName: p.model.productLine.name,
          modelName: p.model.name,
        }))}
      />
    </div>
  );
}
