import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import NewProductForm from './NewProductForm';

export default async function AdminNewProductPage() {
  const brands = await prisma.brand.findMany({
    orderBy: { name: 'asc' },
    include: {
      lines: {
        orderBy: { name: 'asc' },
        include: { models: { orderBy: { name: 'asc' } } },
      },
    },
  });

  return (
    <div className="max-w-3xl">
      <Link href="/admin/produits" className="text-sm text-gray-500 hover:text-gray-800">← Retour à la liste</Link>
      <h1 className="text-2xl font-bold mt-2 mb-1">Nouveau produit</h1>
      <p className="text-gray-500 mb-6">
        Choisis une marque/gamme/modèle existants, ou crée-en de nouveaux directement depuis ce formulaire.
      </p>

      <NewProductForm brands={brands} />
    </div>
  );
}
