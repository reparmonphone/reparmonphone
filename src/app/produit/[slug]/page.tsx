import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { redirectOrNotFound } from '@/lib/pageRedirect';
import { formatPrice } from '@/lib/format';
import AddToCartButton from './AddToCartButton';
import ProductGallery from './ProductGallery';
import RelatedProducts from './RelatedProducts';
import ProductStars from '@/components/ProductStars';
import ProductReviewsSection from './ProductReviewsSection';
import ReviewsAccordion from '@/components/ReviewsAccordion';
import JsonLd from '@/components/JsonLd';
import ShareButton from '@/components/ShareButton';
import FavoriteButton from '@/components/FavoriteButton';
import { getFavoriteProductIds } from '@/app/compte/favoris/actions';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.reparmonphone.fr';

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const product = await prisma.product.findUnique({ where: { slug: params.slug } });
  if (!product) return {};

  const fallbackDescription = product.shortDescription
    ?.replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);

  const title = product.metaTitle || `${product.title} | ReparMonPhone`;
  const description = product.metaDescription || fallbackDescription || undefined;
  const url = `${SITE_URL}/produit/${product.slug}`;
  const image = product.imageUrl || (product.images?.[0] ?? undefined);

  return {
    title,
    description,
    alternates: { canonical: url },
    // Sans ces surcharges, Open Graph/Twitter héritent des valeurs génériques du layout racine —
    // ce qui fait qu'un partage de cette fiche produit sur les réseaux affiche le titre du site
    // au lieu du produit. On les redéfinit explicitement ici pour chaque produit.
    openGraph: {
      title,
      description,
      url,
      type: 'website',
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function ProductPage({ params }: { params: { slug: string } }) {
  const [product, favoriteIds] = await Promise.all([
    prisma.product.findUnique({
      where: { slug: params.slug },
      include: { model: { include: { productLine: { include: { brand: true } } } } },
    }),
    getFavoriteProductIds(),
  ]);

  // Une fiche produit renommée/supprimée (fusion de doublons, réorganisation catalogue) 301 vers sa
  // nouvelle adresse si une redirection a été enregistrée dans /admin/seo, plutôt qu'un 404 sec.
  if (!product) {
    await redirectOrNotFound(`/produit/${params.slug}`);
    notFound(); // jamais exécuté en pratique (redirectOrNotFound lève toujours) — garde le typage TS.
  }

  const relatedGuides = await prisma.repairGuide.findMany({
    where: { modelId: product.modelId, published: true },
    orderBy: { viewCount: 'desc' },
    take: 4,
  });

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
          <div className="flex items-start justify-between gap-3">
            <span className="text-sm text-gray-400">
              {product.model.productLine.brand.name} / {product.model.productLine.name} / {product.model.name}
            </span>
            <FavoriteButton productId={product.id} initialFavorited={favoriteIds.includes(product.id)} />
          </div>
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

          <div className="flex items-stretch gap-2">
            <div className="flex-1">
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
            </div>
            <ShareButton title={product.title} url={`${SITE_URL}/produit/${product.slug}`} />
          </div>

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

      {relatedGuides.length > 0 && (
        <div className="mt-10 bg-brand-light/40 border border-brand/20 rounded-xl p-5">
          <h2 className="font-semibold text-gray-800 mb-3">🔧 Guides de réparation pour ce modèle</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {relatedGuides.map((guide) => (
              <Link
                key={guide.id}
                href={`/reparation/guide/${guide.slug}`}
                className="bg-white rounded-lg p-4 hover:shadow-md transition flex items-center gap-3"
              >
                <span className="text-2xl shrink-0">🔧</span>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{guide.title}</p>
                  {guide.estimatedTime && <p className="text-xs text-gray-400 mt-0.5">⏱ {guide.estimatedTime}</p>}
                </div>
              </Link>
            ))}
          </div>
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
