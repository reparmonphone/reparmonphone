import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { formatPrice } from '@/lib/format';
import AddToCartButton from './AddToCartButton';
import ProductGallery from './ProductGallery';
import RelatedProducts from './RelatedProducts';
import ProductStars from '@/components/ProductStars';
import ProductReviewsSection from './ProductReviewsSection';
import ReviewsAccordion from '@/components/ReviewsAccordion';
import JsonLd from '@/components/JsonLd';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.reparmonphone.fr';

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const product = await prisma.product.findUnique({ where: { slug: params.slug } });
  if (!product) return {};
  const fallbackDescription = product.shortDescription
    ?.replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
  return {
    title: product.metaTitle || `${product.title} | ReparMonPhone`,
    description: product.metaDescription || fallbackDescription || undefined,
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

  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    image: images,
    description: product.shortDescription?.replace(/<[^>]+>/g, ' ').trim() || product.title,
    sku: product.wpId ?? product.id,
    brand: { '@type': 'Brand', name: product.model.productLine.brand.name },
    offers: {
      '@type': 'Offer',
      url: `${SITE_URL}/produit/${product.slug}`,
      priceCurrency: 'EUR',
      price: Number(product.price).toFixed(2),
      availability: product.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
    },
    ...(product.reviewCount > 0 && product.avgRating
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: product.avgRating.toFixed(1),
            reviewCount: product.reviewCount,
          },
        }
      : {}),
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Boutique', item: `${SITE_URL}/boutique` },
      {
        '@type': 'ListItem',
        position: 3,
        name: product.model.productLine.brand.name,
        item: `${SITE_URL}/marque/${product.model.productLine.brand.slug}`,
      },
      { '@type': 'ListItem', position: 4, name: product.title, item: `${SITE_URL}/produit/${product.slug}` },
    ],
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <JsonLd data={productSchema} />
      <JsonLd data={breadcrumbSchema} />
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

          <div className="mt-3">
            <ProductStars rating={product.avgRating} count={product.reviewCount} />
          </div>

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
        <div className="mt-10">
          <div
            className="prose prose-sm md:prose-base max-w-none text-gray-700 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-6 [&_h2]:mb-2"
            dangerouslySetInnerHTML={{ __html: product.description }}
          />
        </div>
      )}

      <RelatedProducts modelId={product.modelId} excludeProductId={product.id} />

      <ReviewsAccordion
        title={
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-gray-900">Avis clients</h2>
            {product.reviewCount > 0 && (
              <span className="flex items-center gap-1.5 text-sm text-gray-500">
                <ProductStars rating={product.avgRating} count={product.reviewCount} showCount={false} />
                {product.avgRating?.toFixed(1)} · {product.reviewCount} avis
              </span>
            )}
          </div>
        }
      >
        <ProductReviewsSection productId={product.id} />
      </ReviewsAccordion>
    </div>
  );
}
