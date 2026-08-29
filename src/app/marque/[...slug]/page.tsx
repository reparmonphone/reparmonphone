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

// Même nettoyage que cleanCardName, mais aussi normalisé en minuscule pour servir de clé de
// correspondance entre le nom d'une gamme en base (ex: "Mate") et le libellé d'une carte du
// contenu scrappé (ex: "Gamme Mate"). Sert de repli quand la correspondance par slug (plus fiable,
// voir extractLineSlug) échoue — par exemple pour les marques qui n'ont jamais eu de gamme
// consolidée depuis la base (Apple, Samsung, Xiaomi).
function normalizeLineName(name: string) {
  return cleanCardName(name).toLowerCase();
}

// Les cartes "Huawei" générées par scripts/consolidate-huawei-categories.js et
// scripts/add-missing-huawei-gammes.js pointent vers des URLs du type
// ".../marque/huawei/huawei-line-{slug}/" ou ".../marque/huawei/huawei-{slug}/" — {slug} étant à
// l'origine le slug Prisma de la ProductLine. Ce slug ne change JAMAIS quand on renomme une gamme
// depuis /admin/gammes (seul son name change) : c'est donc la clé fiable pour retrouver la bonne
// gamme même après un renommage, contrairement au nom qui, lui, devient obsolète dans ce fichier
// figé dès qu'on renomme.
function extractLineSlug(brandSlug: string, href: string): string {
  const segment = lastPathSegment(href);
  if (brandSlug === 'huawei') {
    if (segment.startsWith('huawei-line-')) return segment.slice('huawei-line-'.length);
    if (segment.startsWith('huawei-')) return segment.slice('huawei-'.length);
  }
  return segment;
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

  // On calcule le nombre réel de produits en base pour chaque carte qui n'a pas déjà un
  // "liveCount" précis pré-calculé (voir scripts/consolidate-huawei-categories.js) — ce
  // liveCount, quand présent, vient d'un calcul exact par identifiant de gamme/modèle réel,
  // plus fiable que la recherche floue par texte utilisée ici en repli pour les autres marques.
  const cardsNeedingSearch = content.cards.filter((card) => card.liveCount == null);
  const liveCounts = await Promise.all(
    cardsNeedingSearch.map((card) =>
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
  const countByCardHref = new Map(cardsNeedingSearch.map((card, i) => [card.href, liveCounts[i]]));

  // Sur la page racine d'une marque (ex: /marque/huawei), une gamme peut avoir été renommée ou
  // avoir reçu une nouvelle image depuis /admin/gammes — ces valeurs priment alors sur celles,
  // figées, du contenu scrappé statique. On retrouve la bonne gamme d'abord par slug (fiable même
  // après renommage), puis par nom nettoyé en repli pour les marques sans slug consolidé connu.
  type DbLineOverride = { name: string; imageUrl: string | null };
  let dbLineBySlug = new Map<string, DbLineOverride>();
  let dbLineByNormalizedName = new Map<string, DbLineOverride>();
  if (params.slug.length === 1) {
    const dbLines = await prisma.productLine.findMany({
      where: { brand: { slug: brandSlug } },
      select: { slug: true, name: true, imageUrl: true },
    });
    dbLineBySlug = new Map(dbLines.map((l) => [l.slug, { name: l.name, imageUrl: l.imageUrl }]));
    dbLineByNormalizedName = new Map(dbLines.map((l) => [normalizeLineName(l.name), { name: l.name, imageUrl: l.imageUrl }]));
  }

  function findDbLineOverride(card: { name: string; href: string }): DbLineOverride | undefined {
    const slug = extractLineSlug(brandSlug, card.href);
    return dbLineBySlug.get(slug) ?? dbLineByNormalizedName.get(normalizeLineName(card.name));
  }

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

              const liveCount = card.liveCount ?? countByCardHref.get(card.href) ?? 0;
              const dbOverride = findDbLineOverride(card);
              const displayName = dbOverride?.name ?? card.name;
              const imageUrl = dbOverride?.imageUrl ?? card.imageUrl;

              return (
                <Link key={card.href} href={href} className="group text-center block">
                  <div className="relative aspect-square bg-white mb-3 mx-auto max-w-[200px]">
                    {imageUrl ? (
                      <Image
                        src={imageUrl}
                        alt={displayName}
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
                  <p className="font-semibold text-gray-800 group-hover:text-brand transition">{displayName}</p>
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
