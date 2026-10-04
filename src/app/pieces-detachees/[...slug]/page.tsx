import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import ProductCard from '@/components/ProductCard';
import JsonLd from '@/components/JsonLd';
import { formatPrice } from '@/lib/format';
import { LANDING_PIECES, landingPieceBySlug, MIN_INDEXABLE_PRODUCTS } from '@/lib/landingPages';
import ModelLandingPage, { isModelRoute, modelMetadata } from './ModelLanding';

// Page d'atterrissage "pièce + marque" (/pieces-detachees/apple/ecrans) ou "pièce + gamme"
// (/pieces-detachees/apple/iphone/ecrans). Régénérée au plus toutes les heures.
export const revalidate = 3600;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.reparmonphone.fr';
const PRODUCTS_SHOWN = 48;

async function load(slug: string[]) {
  if (slug.length < 2 || slug.length > 3) return null;
  const piece = landingPieceBySlug(slug[slug.length - 1]);
  if (!piece) return null;

  const brand = await prisma.brand.findUnique({ where: { slug: slug[0] } });
  if (!brand) return null;
  const line = slug.length === 3 ? await prisma.productLine.findFirst({ where: { slug: slug[1], brandId: brand.id } }) : null;
  if (slug.length === 3 && !line) return null;

  const lineFilter: Prisma.ProductLineWhereInput = { brandId: brand.id, ...(line ? { id: line.id } : {}) };
  const base: Prisma.ProductWhereInput = { showInBoutique: true, model: { productLine: lineFilter } };
  const where: Prisma.ProductWhereInput = { ...base, pieceType: piece.type };

  const [products, count, agg, models, byType, lines] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: [{ inStock: 'desc' }, { title: 'asc' }],
      take: PRODUCTS_SHOWN,
      select: {
        id: true,
        slug: true,
        title: true,
        price: true,
        imageUrl: true,
        inStock: true,
        avgRating: true,
        reviewCount: true,
        model: { select: { name: true } },
      },
    }),
    prisma.product.count({ where }),
    prisma.product.aggregate({ where, _min: { price: true } }),
    prisma.model.findMany({
      where: { productLine: lineFilter, products: { some: { showInBoutique: true, pieceType: piece.type } } },
      orderBy: { sortOrder: 'asc' },
      take: 80,
      select: { name: true, slug: true, productLine: { select: { slug: true } } },
    }),
    prisma.product.groupBy({ by: ['pieceType'], where: base, _count: { _all: true } }),
    // Sur une page "marque", on propose aussi la même pièce par gamme (maillage interne vers les pages plus précises).
    line
      ? Promise.resolve([] as { slug: string; name: string }[])
      : prisma.productLine.findMany({
          where: { brandId: brand.id, models: { some: { products: { some: { showInBoutique: true, pieceType: piece.type } } } } },
          orderBy: { sortOrder: 'asc' },
          select: { slug: true, name: true },
        }),
  ]);

  if (count === 0) return null;

  const minPrice = agg?._min?.price != null ? Number(agg._min.price) : null;
  const otherPieces = LANDING_PIECES.filter((p) => p.type !== piece.type).filter((p) =>
    byType.some((b) => b.pieceType === p.type && (b?._count?._all ?? 0) > 0)
  );

  return { brand, line, piece, products, count, minPrice, models, otherPieces, lines };
}

export async function generateMetadata({ params }: { params: { slug: string[] } }): Promise<Metadata> {
  if (isModelRoute(params.slug)) return modelMetadata(params.slug);
  const data = await load(params.slug);
  if (!data) return {};
  const { brand, line, piece, count, minPrice } = data;
  const target = line ? line.name : brand.name;
  const title = `${piece.plural} ${target} : livraison 24h France`;
  const description = `${piece.plural} de remplacement pour ${target} : ${count} référence${count > 1 ? 's' : ''}${
    minPrice != null ? ` dès ${minPrice.toFixed(2).replace('.', ',')} €` : ''
  }, qualité origine ou compatible. Livraison Chronopost 24h partout en France métropolitaine.`;
  const url = `${SITE_URL}/pieces-detachees/${params.slug.join('/')}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    // Page trop peu fournie : visible pour les clients, mais pas proposée à Google (voir MIN_INDEXABLE_PRODUCTS).
    robots: count < MIN_INDEXABLE_PRODUCTS ? { index: false, follow: true } : undefined,
    openGraph: { title, description, url, type: 'website' },
    twitter: { card: 'summary', title, description },
  };
}

export default async function LandingPage({ params }: { params: { slug: string[] } }) {
  if (isModelRoute(params.slug)) {
    const modelPage = await ModelLandingPage({ slug: params.slug });
    if (!modelPage) notFound();
    return modelPage;
  }
  const data = await load(params.slug);
  if (!data) notFound();
  const { brand, line, piece, products, count, minPrice, models, otherPieces, lines } = data;

  const target = line ? line.name : brand.name;
  const basePath = `/pieces-detachees/${brand.slug}${line ? `/${line.slug}` : ''}`;
  const pageUrl = `${SITE_URL}${basePath}/${piece.slug}`;
  const priceText = minPrice != null ? formatPrice(minPrice) : null;

  const faq = [
    {
      q: `Quel est le prix d'un ${piece.singular} pour ${target} ?`,
      a: `Les ${piece.lower} pour ${target} sont proposés${priceText ? ` à partir de ${priceText}` : ''} sur ReparMonPhone, selon le modèle et la qualité (origine ou compatible).`,
    },
    {
      q: `Comment choisir le bon ${piece.singular} pour mon ${target} ?`,
      a: `${piece.advice} En cas de doute, contacte-nous depuis la page Contact avec le nom exact de ton modèle.`,
    },
    {
      q: `Livrez-vous partout en France ?`,
      a: `Oui. La livraison Chronopost 24h est disponible partout en France métropolitaine (selon l'option choisie au moment de la commande). Les autres options et leurs tarifs s'affichent dans le panier.`,
    },
    {
      q: `Puis-je remplacer le ${piece.singular} moi-même ?`,
      a: `Sur beaucoup de modèles, oui : consulte nos guides de réparation. Si tu préfères ne pas t'en charger, tu peux aussi nous envoyer ton appareil grâce à la réparation par correspondance.`,
    },
  ];

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Pièces détachées', item: `${SITE_URL}/pieces-detachees` },
      { '@type': 'ListItem', position: 3, name: `${piece.plural} ${target}`, item: pageUrl },
    ],
  };
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };
  const listLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${piece.plural} ${target}`,
    url: pageUrl,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: products.map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${SITE_URL}/produit/${p.slug}`,
        name: p.title,
      })),
    },
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <JsonLd data={breadcrumb} />
      <JsonLd data={faqLd} />
      <JsonLd data={listLd} />

      <nav className="text-sm text-gray-400 mb-4">
        <Link href="/" className="hover:text-brand">Accueil</Link> <span className="mx-1">›</span>
        <Link href="/pieces-detachees" className="hover:text-brand">Pièces détachées</Link> <span className="mx-1">›</span>
        <span className="text-gray-600">{piece.plural} {target}</span>
      </nav>

      <h1 className="text-3xl font-bold text-gray-900">{piece.plural} {target}</h1>
      <p className="mt-3 text-gray-600 max-w-3xl leading-relaxed">
        Besoin d&apos;un {piece.singular} pour {target} ? ReparMonPhone propose {count} {count > 1 ? piece.lower : piece.singular} de
        remplacement pour {models.length} modèle{models.length > 1 ? 's' : ''} {target}
        {priceText ? `, à partir de ${priceText}` : ''}. Livraison Chronopost 24h disponible partout en France métropolitaine.
      </p>

      {lines.length > 1 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {lines.map((l) => (
            <Link
              key={l.slug}
              href={`${basePath}/${l.slug}/${piece.slug}`}
              className="px-3 py-1.5 rounded-full border border-gray-200 text-sm text-gray-700 hover:bg-gray-50"
            >
              {piece.plural} {l.name}
            </Link>
          ))}
        </div>
      )}

      {models.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Modèles {target} disponibles</h2>
          <div className="flex flex-wrap gap-2">
            {models.map((m) => (
              <Link
                key={`${m.productLine.slug}/${m.slug}`}
                href={`/pieces-detachees/${brand.slug}/${m.productLine.slug}/${m.slug}/${piece.slug}`}
                className="px-3 py-1 rounded-full bg-gray-100 text-sm text-gray-700 hover:bg-gray-200"
              >
                {m.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {piece.plural} {target} en stock
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((p) => (
            <ProductCard
              key={p.id}
              product={{
                id: p.id,
                slug: p.slug,
                title: p.title,
                price: Number(p.price),
                imageUrl: p.imageUrl,
                inStock: p.inStock,
                brandName: brand.name,
                modelName: p.model.name,
                avgRating: p.avgRating,
                reviewCount: p.reviewCount,
              }}
            />
          ))}
        </div>
        {count > products.length && (
          <p className="mt-5 text-sm">
            <Link
              href={`/boutique?marque=${brand.slug}${line ? `&gamme=${line.slug}` : ''}&type=${piece.type}`}
              className="text-brand-dark font-medium hover:underline"
            >
              Voir les {count} {piece.lower} {target} dans la boutique →
            </Link>
          </p>
        )}
      </section>

      <section className="mt-10 max-w-3xl">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Bien choisir son {piece.singular} {target}</h2>
        <p className="text-gray-600 leading-relaxed">{piece.advice}</p>
      </section>

      {otherPieces.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Autres pièces pour {target}</h2>
          <div className="flex flex-wrap gap-2">
            {otherPieces.map((p) => (
              <Link
                key={p.slug}
                href={`${basePath}/${p.slug}`}
                className="px-3 py-1.5 rounded-full border border-gray-200 text-sm text-gray-700 hover:bg-gray-50"
              >
                {p.plural} {target}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-10 max-w-3xl">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Questions fréquentes</h2>
        <div className="space-y-4">
          {faq.map((f) => (
            <div key={f.q}>
              <h3 className="font-medium text-gray-800">{f.q}</h3>
              <p className="text-gray-600 text-sm mt-1 leading-relaxed">{f.a}</p>
            </div>
          ))}
        </div>
        <p className="mt-5 text-sm text-gray-500">
          Pas à l&apos;aise avec la réparation ? Découvre notre <Link href="/reparation-a-distance" className="underline">réparation par correspondance</Link>{' '}
          ou consulte nos <Link href="/reparation" className="underline">guides de réparation</Link>.
        </p>
      </section>
    </div>
  );
}
