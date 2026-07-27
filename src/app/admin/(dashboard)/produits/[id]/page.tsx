import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import ProductEditForm from './ProductEditForm';

export default async function AdminProductEditPage({ params }: { params: { id: string } }) {
  const [product, brands] = await Promise.all([
    prisma.product.findUnique({
      where: { id: params.id },
      include: { model: { include: { productLine: { include: { brand: true } } } } },
    }),
    prisma.brand.findMany({
      orderBy: { name: 'asc' },
      include: {
        lines: {
          orderBy: { name: 'asc' },
          include: { models: { orderBy: { name: 'asc' } } },
        },
      },
    }),
  ]);

  if (!product) notFound();

  return (
    <div className="max-w-3xl">
      <Link href="/admin/produits" className="text-sm text-gray-500 hover:text-gray-800">← Retour à la liste</Link>
      <h1 className="text-2xl font-bold mt-2 mb-1">{product.title}</h1>
      <p className="text-gray-500 mb-6">
        {product.model.productLine.brand.name} / {product.model.productLine.name} / {product.model.name} —{' '}
        <Link href={`/produit/${product.slug}`} target="_blank" className="text-brand hover:underline">
          voir la fiche publique
        </Link>
      </p>

      <ProductEditForm
        brands={brands}
        product={{
          id: product.id,
          title: product.title,
          price: Number(product.price),
          stockQty: product.stockQty,
          inStock: product.inStock,
          shortDescription: product.shortDescription ?? '',
          description: product.description ?? '',
          metaTitle: product.metaTitle ?? '',
          metaDescription: product.metaDescription ?? '',
          images: product.images,
          modelId: product.modelId,
          brandId: product.model.productLine.brandId,
          productLineId: product.model.productLineId,
          condition: product.condition,
          quality: product.quality,
        }}
      />
    </div>
  );
}
