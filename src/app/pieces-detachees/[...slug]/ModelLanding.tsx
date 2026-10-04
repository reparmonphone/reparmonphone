import Link from 'next/link';
import type { Metadata } from 'next';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import ProductCard from '@/components/ProductCard';
import JsonLd from '@/components/JsonLd';
import { formatPrice } from '@/lib/format';
import {
  LANDING_PIECES,
  landingPieceBySlug,
  modelFullName,
  MIN_INDEXABLE_PRODUCTS,
  MIN_MODEL_PIECE_PRODUCTS,
} from '@/lib/landingPages';

// Pages "modèle" (/pieces-detachees/apple/iphone/iphone-12-pro-max) et "modèle + pièce"
// (/pieces-detachees/apple/iphone/iphone-12-pro-max/ecrans). Appelées depuis [...slug]/page.tsx.

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.reparmonphone.fr';
const LANDING_TYPES = LANDING_PIECES.map((p) => p.type);
const PER_TYPE_SHOWN = 8;
const PIECE_PAGE_SHOWN = 48;

const productSelect = {
  id: true,
  slug: true,
  title: true,
  price: true,
  imageUrl: true,
  inStock: true,
  avgRating: true,
  reviewCount: true,
  pieceType: true,
} satisfies Prisma.ProductSelect;

// slug = [marque, gamme, modèle] ou [marque, gamme, modèle, pièce]
export function isModelRoute(slug: string[]): boolean {
  if (slug.length === 4) return true;
  return slug.length === 3 && !landingPieceBySlug(slug[2]);
}

export async function loadModel(slug: string[]) {
  const [brandSlug, lineSlug, modelSlug, pieceSlug] = slug;
  const piece = pieceSlug ? landingPieceBySlug(pieceSlug) : undefined;
  if (pieceSlug && !piece) return null;

  const model = await prisma.model.findFirst({
    where: { slug: modelSlug, productLine: { slug: lineSlug, brand: { slug: brandSlug } } },
    include: { productLine: { include: { brand: true } } },
  });
  if (!model) return null;

  const line = model.productLine;
  const brand = line.brand;
  const baseWhere: Prisma.ProductWhereInput = {
    showInBoutique: true,
    modelId: model.id,
    pieceType: { in: [...LANDING_TYPES] },
  };
  const where: Prisma.ProductWhereInput = piece ? { ...baseWhere, pieceType: piece.type } : baseWhere;

  const [products, count, agg, byType, siblings] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: [{ inStock: 'desc' }, { title: 'asc' }],
      take: piece ? PIECE_PAGE_SHOWN : 200,
      select: productSelect,
    }),
    prisma.product.count({ where }),
    prisma.product.aggregate({ where, _min: { price: true } }),
    prisma.product.groupBy({ by: ['pieceType'], where: baseWhere, _count: { _all: true } }),
    // Maillage interne : les autres modèles de la même gamme qui ont aussi cette pièce (ou n'importe quelle pièce).
    prisma.model.findMany({
      where: {
        productLine: { id: line.id },
        id: { not: model.id },
        products: {
          some: { showInBoutique: true, pieceType: piece ? piece.type : { in: [...LANDING_TYPES] } },
        },
      },
      orderBy: { sortOrder: 'asc' },
      take: 24,
      select: { name: true, slug: true },
    }),
  ]);

  if (count === 0) return null;

  const minPrice = agg?._min?.price != null ? Number(agg._min.price) : null;
  const fullName = modelFullName(brand.name, line.name, model.name);
  const piecesAvailable = LANDING_PIECES.map((p) => ({
    piece: p,
    count: byType.find((b) => b.pieceType === p.type)?._count?._all ?? 0,
  })).filter((x) => x.count > 0);
  const totalAll = piecesAvailable.reduce((s, x) => s + x.count, 0);

  return { brand, line, model, piece, products, count, minPrice, fullName, piecesAvailable, totalAll, siblings };
}

type ModelData = NonNullable<Awaited<ReturnType<typeof loadModel>>>;

function pagePath(d: ModelData, withPiece = true) {
  return `/pieces-detachees/${d.brand.slug}/${d.line.slug}/${d.model.slug}${withPiece && d.piece ? `/${d.piece.slug}` : ''}`;
}

export async function modelMetadata(slug: string[]): Promise<Metadata> {
  const d = await loadModel(slug);
  if (!d) return {};
  const { piece, fullName, count, minPrice, totalAll } = d;
  const priceTxt = minPrice != null ? ` dès ${minPrice.toFixed(2).replace('.', ',')} €` : '';

  let title: string;
  let description: string;
  let indexable: boolean;
  if (piece) {
    title = `${piece.plural} ${fullName} : livraison 24h France`;
    description = `${piece.singular.charAt(0).toUpperCase()}${piece.singular.slice(1)} ${fullName} : ${count} référence${count > 1 ? 's' : ''}${priceTxt}, qualité origine ou compatible. Expédition Chronopost 24h partout en France métropolitaine.`;
    indexable = count >= MIN_MODEL_PIECE_PRODUCTS;
  } else {
    title = `Pièces détachées ${fullName} : écran, batterie, connecteur`;
    description = `Toutes les pièces détachées pour ${fullName} : ${totalAll} référence${totalAll > 1 ? 's' : ''}${priceTxt}. Écran, batterie, connecteur de charge… Livraison Chronopost 24h partout en France.`;
    indexable = totalAll >= MIN_INDEXABLE_PRODUCTS;
  }
  const url = `${SITE_URL}${pagePath(d)}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: indexable ? undefined : { index: false, follow: true },
    openGraph: { title, description, url, type: 'website' },
    twitter: { card: 'summary', title, description },
  };
}

export default async function ModelLandingPage({ slug }: { slug: string[] }) {
  const d = await loadModel(slug);
  if (!d) return null;
  const { brand, line, model, piece, products, count, minPrice, fullName, piecesAvailable, siblings } = d;

  const priceText = minPrice != null ? formatPrice(minPrice) : null;
  const url = `${SITE_URL}${pagePath(d)}`;
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  const h1 = piece ? `${piece.plural} ${fullName}` : `Pièces détachées ${fullName}`;

  const faq = piece
    ? [
        {
          q: `Quel est le prix d'un ${piece.singular} pour ${fullName} ?`,
          a: `Les ${piece.lower} pour ${fullName} sont proposés${priceText ? ` à partir de ${priceText}` : ''} sur ReparMonPhone, selon la qualité (origine ou compatible).`,
        },
        {
          q: `Comment être sûr que le ${piece.singular} est compatible avec mon ${fullName} ?`,
          a: `Chaque pièce est listée pour un modèle précis. Vérifie le nom exact de ton appareil (dans les réglages du téléphone ou sur l'étiquette au dos), puis choisis la référence correspondante. ${piece.advice}`,
        },
        {
          q: `Livrez-vous partout en France ?`,
          a: `Oui. La livraison Chronopost 24h est disponible partout en France métropolitaine (selon l'option choisie au moment de la commande). Les autres options et leurs tarifs s'affichent dans le panier.`,
        },
        {
          q: `Puis-je remplacer le ${piece.singular} de mon ${fullName} moi-même ?`,
          a: `Sur beaucoup de modèles, oui : consulte nos guides de réparation. Si tu préfères ne pas t'en charger, tu peux aussi nous envoyer ton appareil grâce à la réparation par correspondance.`,
        },
      ]
    : [
        {
          q: `Quelles pièces détachées proposez-vous pour ${fullName} ?`,
          a: `Pour ${fullName}, nous proposons : ${piecesAvailable.map((x) => x.piece.lower).join(', ')}${priceText ? `, à partir de ${priceText}` : ''}. Qualité origine ou compatible selon les références.`,
        },
        {
          q: `Comment trouver la bonne pièce pour mon ${fullName} ?`,
          a: `Choisis d'abord le type de pièce (écran, batterie, connecteur de charge…), puis vérifie que la référence correspond bien au nom exact de ton modèle. En cas de doute, contacte-nous avec le nom de ton appareil.`,
        },
        {
          q: `Livrez-vous partout en France ?`,
          a: `Oui. La livraison Chronopost 24h est disponible partout en France métropolitaine (selon l'option choisie au moment de la commande).`,
        },
        {
          q: `Puis-je réparer mon ${fullName} moi-même ?`,
          a: `Sur beaucoup de modèles, oui : consulte nos guides de réparation. Sinon, tu peux nous envoyer ton appareil grâce à la réparation par correspondance.`,
        },
      ];

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Pièces détachées', item: `${SITE_URL}/pieces-detachees` },
      { '@type': 'ListItem', position: 3, name: `${piece ? 'Pièces' : 'Pièces détachées'} ${fullName}`, item: `${SITE_URL}${pagePath(d, false)}` },
      ...(piece ? [{ '@type': 'ListItem', position: 4, name: h1, item: url }] : []),
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
    name: h1,
    url,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: products.slice(0, PIECE_PAGE_SHOWN).map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${SITE_URL}/produit/${p.slug}`,
        name: p.title,
      })),
    },
  };

  const toCard = (p: (typeof products)[number]) => (
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
        modelName: model.name,
        avgRating: p.avgRating,
        reviewCount: p.reviewCount,
      }}
    />
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <JsonLd data={breadcrumb} />
      <JsonLd data={faqLd} />
      <JsonLd data={listLd} />

      <nav className="text-sm text-gray-400 mb-4">
        <Link href="/" className="hover:text-brand">Accueil</Link> <span className="mx-1">›</span>
        <Link href="/pieces-detachees" className="hover:text-brand">Pièces détachées</Link> <span className="mx-1">›</span>
        {piece ? (
          <>
            <Link href={pagePath(d, false)} className="hover:text-brand">{fullName}</Link> <span className="mx-1">›</span>
            <span className="text-gray-600">{piece.plural}</span>
          </>
        ) : (
          <span className="text-gray-600">{fullName}</span>
        )}
      </nav>

      <h1 className="text-3xl font-bold text-gray-900">{h1}</h1>
      <p className="mt-3 text-gray-600 max-w-3xl leading-relaxed">
        {piece
          ? `Besoin d'un ${piece.singular} pour ${fullName} ? ReparMonPhone propose ${count} ${count > 1 ? piece.lower : piece.singular} de remplacement${priceText ? `, à partir de ${priceText}` : ''}. Livraison Chronopost 24h disponible partout en France métropolitaine.`
          : `Toutes les pièces de remplacement pour ${fullName} : ${piecesAvailable.map((x) => x.piece.lower).join(', ')}${priceText ? `, à partir de ${priceText}` : ''}. Livraison Chronopost 24h disponible partout en France métropolitaine.`}
      </p>

      {/* Navigation entre les pièces du même modèle */}
      {piecesAvailable.length > 1 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {!piece ? null : (
            <Link href={pagePath(d, false)} className="px-3 py-1.5 rounded-full border border-gray-200 text-sm text-gray-700 hover:bg-gray-50">
              Toutes les pièces {fullName}
            </Link>
          )}
          {piecesAvailable
            .filter((x) => x.piece.type !== piece?.type)
            .map((x) => (
              <Link
                key={x.piece.slug}
                href={`${pagePath(d, false)}/${x.piece.slug}`}
                className="px-3 py-1.5 rounded-full border border-gray-200 text-sm text-gray-700 hover:bg-gray-50"
              >
                {x.piece.plural} {fullName}
              </Link>
            ))}
        </div>
      )}

      {piece ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {piece.plural} {fullName} en stock
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">{products.map(toCard)}</div>
        </section>
      ) : (
        piecesAvailable.map((x) => {
          const items = products.filter((p) => p.pieceType === x.piece.type);
          return (
            <section key={x.piece.slug} className="mt-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                <Link href={`${pagePath(d, false)}/${x.piece.slug}`} className="hover:text-brand-dark">
                  {x.piece.plural} {fullName}
                </Link>
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">{items.slice(0, PER_TYPE_SHOWN).map(toCard)}</div>
              {x.count > PER_TYPE_SHOWN && (
                <p className="mt-4 text-sm">
                  <Link href={`${pagePath(d, false)}/${x.piece.slug}`} className="text-brand-dark font-medium hover:underline">
                    Voir les {x.count} {x.piece.lower} {fullName} →
                  </Link>
                </p>
              )}
            </section>
          );
        })
      )}

      {piece && (
        <section className="mt-10 max-w-3xl">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Bien choisir son {piece.singular} {fullName}</h2>
          <p className="text-gray-600 leading-relaxed">{piece.advice}</p>
        </section>
      )}

      {siblings.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            {piece ? `${piece.plural} pour d'autres modèles ${line.name}` : `Autres modèles ${line.name}`}
          </h2>
          <div className="flex flex-wrap gap-2">
            {siblings.map((m) => (
              <Link
                key={m.slug}
                href={`/pieces-detachees/${brand.slug}/${line.slug}/${m.slug}${piece ? `/${piece.slug}` : ''}`}
                className="px-3 py-1 rounded-full bg-gray-100 text-sm text-gray-700 hover:bg-gray-200"
              >
                {m.name}
              </Link>
            ))}
          </div>
          <p className="mt-4 text-sm text-gray-500">
            Voir aussi :{' '}
            {piece && (
              <>
                <Link href={`/pieces-detachees/${brand.slug}/${line.slug}/${piece.slug}`} className="underline">
                  {cap(piece.lower)} {line.name}
                </Link>{' '}
                ·{' '}
              </>
            )}
            <Link href={`/marque/${brand.slug}/${line.slug}`} className="underline">
              Toute la gamme {line.name}
            </Link>
          </p>
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
