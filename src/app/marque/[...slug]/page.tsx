import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { prisma } from '@/lib/prisma';
import { redirectOrNotFound } from '@/lib/pageRedirect';
import {
  getBrandContent,
  getContentByKey,
  getOurSlugForContentKey,
  lastPathSegment,
  isBranchCard,
  type CategoryCard,
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
// correspondance entre le nom d'une gamme/modèle en base (ex: "Mate") et le libellé d'une carte du
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
// figé dès qu'on renomme. Fonctionne aussi bien sur une URL complète que sur un simple segment.
function extractLineSlug(brandSlug: string, hrefOrSegment: string): string {
  const segment = lastPathSegment(hrefOrSegment);
  if (brandSlug === 'huawei') {
    if (segment.startsWith('huawei-line-')) return segment.slice('huawei-line-'.length);
    if (segment.startsWith('huawei-')) return segment.slice('huawei-'.length);
  }
  return segment;
}

// Une carte "générée depuis la base" (voir extractLineSlug) doit disparaître du site public dès
// que la gamme correspondante est supprimée dans /admin/gammes — sinon elle continue de s'afficher
// indéfiniment dans ce fichier figé, avec 0 produit, comme un fantôme. Les cartes qui ne suivent
// pas ce format d'URL (autres marques, ou contenu jamais lié à une gamme réelle) ne sont jamais
// masquées : on ne peut pas savoir si elles sont "supprimées" puisqu'elles n'ont jamais été liées.
function isDbGeneratedCard(brandSlug: string, href: string): boolean {
  const segment = lastPathSegment(href);
  return brandSlug === 'huawei' && (segment.startsWith('huawei-line-') || segment.startsWith('huawei-'));
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

  // Sur la page racine d'une marque, l'absence de contenu scrappé est fatale (aucune marque de ce
  // catalogue n'a jamais existé que via ce fichier figé). Sur la page d'une gamme précise en
  // revanche, l'absence de contenu peut simplement signifier une gamme entièrement nouvelle, créée
  // depuis /admin/gammes après la migration (ex: "Galaxy Z", "Galaxy Tab") — on vérifie la base
  // avant de décider un 404, voir plus bas.
  // Une gamme renommée/supprimée/fusionnée (voir scripts de nettoyage catalogue) 301 vers sa nouvelle
  // adresse si une redirection a été enregistrée dans /admin/seo, plutôt qu'un 404 sec — le middleware
  // ne vérifie pas les URLs /marque lui-même (voir KNOWN_PREFIXES dans src/middleware.ts).
  if (params.slug.length === 1 && !content) {
    await redirectOrNotFound(`/marque/${params.slug.join('/')}`);
    notFound(); // jamais exécuté en pratique (redirectOrNotFound lève toujours) — garde le typage TS.
  }

  // On charge TOUTES les gammes de la marque avec leurs modèles (et de quoi calculer un compteur
  // produit exact par modèle) une seule fois : la correspondance avec le contenu scrappé statique
  // se fait ensuite en mémoire, aussi bien pour la page racine d'une marque (liste des gammes) que
  // pour la page d'une gamme précise (liste des modèles) — voir plus bas.
  type DbModel = { id: string; name: string; slug: string; imageUrl: string | null; productCount: number; repImageUrl: string | null };
  type DbLine = { id: string; name: string; slug: string; imageUrl: string | null; models: DbModel[] };
  const dbLinesRaw = await prisma.productLine.findMany({
    where: { brand: { slug: brandSlug } },
    select: {
      id: true,
      name: true,
      slug: true,
      imageUrl: true,
      models: {
        select: {
          id: true,
          name: true,
          slug: true,
          imageUrl: true,
          products: { where: { showInBoutique: true }, select: { id: true, imageUrl: true } },
        },
      },
    },
  });
  const dbLines: DbLine[] = dbLinesRaw.map((l) => ({
    id: l.id,
    name: l.name,
    slug: l.slug,
    imageUrl: l.imageUrl,
    models: l.models.map((m) => ({
      id: m.id,
      name: m.name,
      slug: m.slug,
      imageUrl: m.imageUrl,
      productCount: m.products.length,
      repImageUrl: m.products.find((p) => p.imageUrl)?.imageUrl ?? null,
    })),
  }));

  let pageTitle: string;
  let pageDescription: string | null;
  let resolvedCards: CategoryCard[];

  if (params.slug.length === 1) {
    // ---------- Page racine d'une marque (ex: /marque/samsung) ----------
    // Une gamme peut avoir été renommée, supprimée, ou avoir reçu une nouvelle image depuis
    // /admin/gammes — ces changements priment alors sur le contenu scrappé statique, figé depuis
    // la migration. On retrouve la bonne gamme d'abord par slug (fiable même après renommage),
    // puis par nom nettoyé en repli pour les marques sans slug consolidé connu.
    const dbLineBySlug = new Map(dbLines.map((l) => [l.slug, l]));
    const dbLineByNormalizedName = new Map(dbLines.map((l) => [normalizeLineName(l.name), l]));

    function findDbLineOverride(card: CategoryCard): DbLine | undefined {
      const slug = extractLineSlug(brandSlug, card.href);
      return dbLineBySlug.get(slug) ?? dbLineByNormalizedName.get(normalizeLineName(card.name));
    }

    const matchedLineIds = new Set<string>();
    const staticCards = content?.cards ?? [];

    // Retire les cartes dont la gamme d'origine a été supprimée dans /admin/gammes (sans quoi elles
    // continueraient de s'afficher indéfiniment, à 0 produit, depuis le fichier figé), et applique
    // le nom/l'image à jour quand une correspondance existe.
    const overriddenCards = staticCards
      .filter((card) => {
        if (!isDbGeneratedCard(brandSlug, card.href)) return true;
        return dbLineBySlug.has(extractLineSlug(brandSlug, card.href));
      })
      .map((card) => {
        const dbLine = findDbLineOverride(card);
        if (!dbLine) return card;
        matchedLineIds.add(dbLine.id);
        return { ...card, name: dbLine.name, imageUrl: dbLine.imageUrl ?? card.imageUrl };
      });

    // Gammes créées depuis /admin/gammes qui n'ont encore AUCUNE carte dans le fichier figé (ex:
    // une gamme entièrement nouvelle comme "Galaxy Z" ou "Galaxy Tab") : on les ajoute directement,
    // en carte "branche" (menant à la liste de ses modèles, voir plus bas et le calcul de `branch`).
    const newLineCards: CategoryCard[] = dbLines
      .filter((l) => !matchedLineIds.has(l.id))
      .map((l) => ({
        name: l.name,
        imageUrl: l.imageUrl ?? l.models.find((m) => m.imageUrl || m.repImageUrl)?.imageUrl ?? null,
        href: `${SITE_URL}/marque/${brandSlug}/${l.slug}/`,
        count: null,
      }));

    pageTitle = content?.title ?? brandSlug;
    pageDescription = content?.description ?? null;
    resolvedCards = [...overriddenCards, ...newLineCards];
  } else {
    // ---------- Page d'une gamme précise (ex: /marque/samsung/galaxy-a) ----------
    // La clé du contenu scrappé statique ne correspond pas toujours à notre slug interne de gamme
    // (ex: clé scrappée "iphones" pour notre gamme "iphone") — getOurSlugForContentKey couvre ces
    // correspondances déjà répertoriées (voir LINE_CONTENT_KEY). On tente ensuite le format Huawei
    // ("huawei-line-x"), puis le segment brut tel quel (cas d'une gamme créée depuis
    // /admin/gammes : son slug EST le segment d'URL utilisé pour la carte générée au niveau racine
    // ci-dessus), puis enfin le nom du contenu scrappé en dernier repli.
    const segment = params.slug[params.slug.length - 1];
    const mappedSlug = getOurSlugForContentKey(brandSlug, segment);
    const strippedSlug = extractLineSlug(brandSlug, segment);
    const candidateSlugs = new Set([mappedSlug, strippedSlug, segment].filter((s): s is string => !!s));

    const dbLine =
      dbLines.find((l) => candidateSlugs.has(l.slug)) ??
      (content ? dbLines.find((l) => normalizeLineName(l.name) === normalizeLineName(content.title)) : undefined);

    if (!content && !dbLine) {
      await redirectOrNotFound(`/marque/${params.slug.join('/')}`);
      notFound(); // jamais exécuté en pratique (redirectOrNotFound lève toujours) — garde le typage TS.
    }

    const modelBySlug = new Map((dbLine?.models ?? []).map((m) => [m.slug, m]));
    const modelByNormalizedName = new Map((dbLine?.models ?? []).map((m) => [normalizeLineName(m.name), m]));

    function findDbModelOverride(card: CategoryCard): DbModel | undefined {
      const slug = lastPathSegment(card.href);
      return modelBySlug.get(slug) ?? modelByNormalizedName.get(normalizeLineName(card.name));
    }

    const matchedModelIds = new Set<string>();
    const staticCards = content?.cards ?? [];

    const overriddenCards = staticCards.map((card) => {
      const dbModel = findDbModelOverride(card);
      if (!dbModel) return card;
      matchedModelIds.add(dbModel.id);
      return {
        ...card,
        name: dbModel.name,
        imageUrl: dbModel.imageUrl ?? dbModel.repImageUrl ?? card.imageUrl,
        liveCount: dbModel.productCount,
      };
    });

    // Modèles ajoutés depuis /admin/gammes qui n'ont encore aucune carte dans le fichier figé
    // (nouvelle gamme entière, ou nouveau modèle ajouté dans une gamme existante).
    const newModelCards: CategoryCard[] = (dbLine?.models ?? [])
      .filter((m) => !matchedModelIds.has(m.id))
      .map((m) => ({
        name: m.name,
        imageUrl: m.imageUrl ?? m.repImageUrl ?? null,
        href: `${SITE_URL}/marque/${params.slug.join('/')}/${m.slug}/`,
        count: null,
        liveCount: m.productCount,
      }));

    pageTitle = content?.title ?? dbLine?.name ?? segment.replace(/-/g, ' ');
    pageDescription = content?.description ?? null;
    resolvedCards = [...overriddenCards, ...newModelCards];
  }

  // On calcule le nombre réel de produits en base pour chaque carte qui n'a pas déjà un
  // "liveCount" précis pré-calculé (soit par scripts/consolidate-huawei-categories.js, soit
  // ci-dessus par correspondance directe avec une gamme/un modèle de la base) — cette recherche
  // floue par texte ne sert donc plus que de repli pour les cartes jamais reliées à la base.
  const cardsNeedingSearch = resolvedCards.filter((card) => card.liveCount == null);
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
        <h1 className="text-3xl font-light tracking-wide text-gray-800 uppercase">{pageTitle}</h1>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-10">
        {resolvedCards.length === 0 ? (
          <p className="text-gray-500">Aucune sous-catégorie à afficher pour le moment.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-x-6 gap-y-10">
            {resolvedCards.map((card) => {
              const segment = lastPathSegment(card.href);
              // Une carte est une "branche" (menant à une sous-page) si le contenu scrappé statique
              // la reconnaît comme telle, OU si son segment correspond à une gamme de la base sur la
              // page racine d'une marque (cas d'une gamme créée depuis /admin/gammes, sans section
              // scrappée statique associée).
              const branch = isBranchCard(card) || (params.slug.length === 1 && dbLines.some((l) => l.slug === segment));
              const href = branch
                ? `/marque/${[...params.slug, segment].join('/')}`
                : `/boutique?marque=${brandSlug}&q=${encodeURIComponent(card.name)}`;

              const liveCount = card.liveCount ?? countByCardHref.get(card.href) ?? 0;

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

        {pageDescription && (
          <div
            className="mt-12 pt-8 border-t border-gray-100 text-gray-600 leading-relaxed space-y-3 [&_strong]:text-gray-800"
            dangerouslySetInnerHTML={{ __html: pageDescription }}
          />
        )}
      </div>
    </div>
  );
}
