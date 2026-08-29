import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  getBrandContent,
  getContentByKey,
  lastPathSegment,
  isBranchCard,
} from '@/lib/categoryContent';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.reparmonphone.fr';

function resolveContent(slug: string[]) {
  const brandSlug = slug[0];
  const currentSegment = slug[slug.length - 1];
  // Premier niveau (ex: /marque/apple) : contenu identifié par la marque elle-même.
  // Niveaux suivants (ex: /marque/apple/iphones) : contenu identifié par le dernier segment.
  return slug.length === 1 ? getBrandContent(brandSlug) : getContentByKey(currentSegment);
}

export async function generateMetadata({ params }: { params: { slug: string[] } }) {
  const content = resolveContent(params.slug);
  if (!content) return {};

  const plainDescription = content.description
    ?.replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);

  const title = `${content.title} — Pièces détachées & Accessoires | ReparMonPhone`;
  const description =
    plainDescription ||
    `Pièces détachées et accessoires ${content.title} : écrans, batteries, connecteurs de charge. Livraison Chronopost 24h partout en France.`;
  const url = `${SITE_URL}/marque/${params.slug.join('/')}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default function CategoryPage({ params }: { params: { slug: string[] } }) {
  const brandSlug = params.slug[0];
  const content = resolveContent(params.slug);

  if (!content) notFound();

  return (
    <div>
      <div className="bg-gray-50 border-b border-gray-100 py-8 text-center">
        <p className="text-sm text-gray-400 mb-2">
          <Link href="/" className="hover:text-brand">Accueil</Link> <span className="mx-1">›</span>
          {params.slug.length > 1 && (
            <>
              <Link href={`/marque/${brandSlug}`} className="hover:text-brand capitalize">{brandSlug}</Link>
              <span className="mx-1">›</span>
            </>
          )}
        </p>
        <h1 className="text-3xl font-light tracking-wide text-gray-800 uppercase">{content.title}</h1>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-10">
        {content.cards.length === 0 ? (
          <p className="text-gray-500">Aucune sous-catégorie à afficher pour le moment.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-x-6 gap-y-10">
            {content.cards.map((card) => {
              const segment = lastPathSegment(card.href);
              const branch = isBranchCard(card);
              const href = branch
                ? `/marque/${[...params.slug, segment].join('/')}`
                : `/boutique?marque=${brandSlug}&q=${encodeURIComponent(card.name)}`;

              return (
                <Link key={card.href} href={href} className="group text-center block">
                  <div className="relative aspect-square bg-white mb-3 mx-auto max-w-[200px]">
                    <Image
                      src={card.imageUrl}
                      alt={card.name}
                      fill
                      className="object-contain group-hover:scale-105 transition"
                      sizes="200px"
                      unoptimized
                    />
                  </div>
                  <p className="font-semibold text-gray-800 group-hover:text-brand transition">{card.name}</p>
                  {card.count !== null && (
                    <p className="text-sm text-brand italic underline">
                      {card.count} produit{card.count > 1 ? 's' : ''}
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        )}

        {content.description && (
          <div
            className="mt-12 pt-8 border-t border-gray-100 text-gray-600 leading-relaxed space-y-3 [&_strong]:text-gray-800"
            dangerouslySetInnerHTML={{ __html: content.description }}
          />
        )}
      </div>
    </div>
  );
}
