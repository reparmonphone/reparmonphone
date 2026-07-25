import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { formatPrice } from '@/lib/format';
import AddToCartButton from './AddToCartButton';
import ProductGallery from './ProductGallery';

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const product = await prisma.product.findUnique({ where: { slug: params.slug } });
  if (!product) return {};
  return {
    title: product.metaTitle || `${product.title} | ReparMonPhone`,
    description: product.metaDescription || product.shortDescription?.slice(0, 160) || undefined,
  };
}

export default async function ProductPage({ params }: { params: { slug: string } }) {
  const product = await prisma.product.findUnique({
    where: { slug: params.slug },
    include: { model: { include: { productLine: { include: { brand: true } } } } },
  });

  if (!product) notFound();

  const images = product.images && product.images.length > 0
    ? product.images
    : product.imageUrl
    ? [product.imageUrl]
    : [];

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="grid md:grid-cols-2 gap-10">
        <ProductGallery images={images} title={product.title} />

        <div>
          <span className="text-sm text-gray-400">
            {product.model.productLine.brand.name} / {product.model.productLine.name} / {product.model.name}
          </span>
          <h1 className="text-2xl font-bold mt-1 mb-4">{product.title}</h1>

          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl font-extrabold text-brand-dark">{formatPrice(Number(product.price))}</span>
            {product.regularPrice && Number(product.regularPrice) > Number(product.price) && (
              <span className="text-gray-400 line-through">{formatPrice(Number(product.regularPrice))}</span>
            )}
          </div>

          <div className="flex gap-2 mb-6 text-sm flex-wrap">
            {product.quality && <span className="bg-gray-100 px-3 py-1 rounded-full">{product.quality}</span>}
            {product.condition && <span className="bg-gray-100 px-3 py-1 rounded-full">{product.condition}</span>}
            <span className={`px-3 py-1 rounded-full ${product.inStock ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {product.inStock ? 'En stock' : 'Rupture de stock'}
            </span>
          </div>

          <AddToCartButton
            product={{
              productId: product.id,
              slug: product.slug,
              title: product.title,
              price: Number(product.price),
              imageUrl: product.imageUrl,
            }}
            disabled={!product.inStock}
          />

          {/* Petite description juste en dessous du bouton "Ajouter au panier" */}
          {product.shortDescription && (
            <div
              className="mt-6 text-sm text-gray-600 leading-relaxed [&_strong]:text-gray-800"
              dangerouslySetInnerHTML={{ __html: product.shortDescription }}
            />
          )}
        </div>
      </div>

      {/* Grande description, pleine largeur, sous toute la fiche produit */}
      {product.description && (
        <div className="mt-12 pt-10 border-t border-gray-200">
          <div
            className="prose prose-sm md:prose-base max-w-none text-gray-700 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-6 [&_h2]:mb-2"
            dangerouslySetInnerHTML={{ __html: product.description }}
          />
        </div>
      )}
    </div>
  );
}
