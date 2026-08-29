import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { prisma } from '@/lib/prisma';
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
  return slug.length === 1 ? getBrandContent(brandSlug) : getContentByKey(currentSegment);
}

// Certaines cartes affichent un libellé du style "Gamme P" alors que le nom réel en base est
// juste "P" (ou "Huawei P") — on nettoie ce préfixe avant de chercher, pour que le comptage
// fonctionne quel que soit le style d'affichage choisi à l'origine.
function cleanCardName(name: string) {
  return name.replace(/^gamme\s+/i, '').trim();
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

export default async function CategoryPage({ params }: { params: { slug: string[] } }) {
  const brandSlug = params.slug[0];
  const content = resolveContent(params.slug);

  if (!content) notFound();

  // On calcule le nombre réel de produits en base pour CHAQUE carte (feuille ET branche),
  // plutôt que d'afficher un chiffre figé depuis la migration WooCommerce (faux ou manquant dès
  // qu'un produit est ajouté/retiré après coup, ou totalement absent pour les catégories créées
  // après la migration). La recherche (titre OU nom du modèle contient le nom nettoyé de la carte,
  // filtré sur la marque courante) reproduit celle utilisée par le lien de la carte, pour qu'un
  // chiffre affiché corresponde toujours à ce qu'on voit réellement une fois sur /boutique.
  const liveCounts = await Promise.all(
    content.cards.map((card) =>
      prisma.product.count({
        where: {
          showInBoutique: true,
          model: { productLine: { brand: { slug: brandSlug } } },
          OR: [
            { title: { contains: cleanCardName(card.name), mode: 'insensitive' } },
            { model: { name: { contains: cleanCardName(card.name), mode: 'insensitive' } } },
          ],
        },
      })
    )
  );
  const countByCardHref = new Map(content.cards.map((card, i) => [card.href, liveCounts[i]]));

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

              const liveCount = countByCardHref.get(card.href) ?? 0;

              return (
                <Link key={card.href} href={href} className="group text-center block">
                  <div className="relative aspect-square bg-white mb-3 mx-auto max-w-[200px]">
                    {card.imageUrl ? (
                      <Image
                        src={card.imageUrl}
                        alt={card.name}
                        fill
                        className="object-contain group-hover:scale-105 transition"
                        sizes="200px"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300 text-3xl bg-gray-50">
                        📱
                      </div>
                    )}
                  </div>
                  <p className="font-semibold text-gray-800 group-hover:text-brand transition">{card.name}</p>
                  {liveCount > 0 ? (
                    <p className="text-sm text-brand italic underline">
                      {liveCount} produit{liveCount > 1 ? 's' : ''}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-400 italic">Aucune pièce disponible</p>
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
