import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import ProductCard from '@/components/ProductCard';
import Filters from '@/components/Filters';
import type { PieceType } from '@prisma/client';
import { getFavoriteProductIds } from '@/app/compte/favoris/actions';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.reparmonphone.fr';

type BoutiqueSearchParams = { marque?: string; gamme?: string; modele?: string; type?: string; q?: string; page?: string };

// Nombre de produits affichés par page. Avant l'ajout de la pagination, la page ne montrait jamais
// que les 60 premiers produits (par ordre alphabétique) d'une catégorie, sans aucun moyen d'accéder
// aux suivants — invisible pour une petite sélection, mais bloquant pour une gamme qui contient
// plusieurs centaines de produits (ex: "Accessoires > Protection > iPhone", 247 produits).
const PAGE_SIZE = 60;

// Une recherche "A52" ne doit matcher que "A52" en tant que référence isolée (ex: dans le titre
// "... Galaxy A52 4G (A525F) ...", ou le nom de modèle "A52"), pas n'importe quelle référence qui
// contient "52" par pure coïncidence de sous-chaîne (ex: "A520F" pour le modèle "A5 2017", ou
// "A730F" pour "A8+ 2018") — sinon la recherche mélange des modèles totalement différents. On exige
// donc que le texte trouvé ne soit pas immédiatement collé à une lettre/chiffre avant ou après.
function matchesWholeWord(text: string, query: string): boolean {
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(text);
}

// "iPhone 16" est un début de mot parfaitement valide de "iPhone 16 Pro Max" -> matchesWholeWord
// seul ne suffit pas à les séparer (contrairement à "A520F" où "A52" n'est PAS suivi d'une limite
// de mot). Ici il faut une vraie priorité : si le texte tapé correspond EXACTEMENT (une fois
// espaces/accents/casse ignorés) au nom d'un modèle existant, on ne montre QUE ce modèle précis,
// sans les modèles voisins dont le nom est plus long ("16 Pro", "16 Pro Max", "16 Plus"...).
function normalizeModelQuery(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

// Même correctif que src/app/api/search/route.ts : une recherche à plusieurs mots (ex: "verre trempé
// iphone 14") ne doit pas être cherchée comme une seule chaîne contiguë — les mots peuvent apparaître
// dans un ordre différent dans le titre, avec d'autres mots intercalés. On exige que chaque mot de la
// recherche apparaisse quelque part dans le titre, peu importe l'ordre.
function tokenize(q: string): string[] {
  return q.split(/\s+/).map((t) => t.trim()).filter(Boolean);
}

export async function generateMetadata({ searchParams }: { searchParams: BoutiqueSearchParams }) {
  const hasFilters = !!(searchParams.marque || searchParams.gamme || searchParams.modele || searchParams.type || searchParams.q);

  let title = 'Boutique — Pièces détachées téléphone';
  let description =
    'Toutes nos pièces détachées et accessoires pour smartphone : écrans, batteries, connecteurs de charge. Apple, Samsung, Huawei, Xiaomi. Livraison Chronopost 24h.';

  if (hasFilters) {
    const labelParts = [searchParams.marque, searchParams.gamme, searchParams.modele, searchParams.q].filter(Boolean);
    if (labelParts.length > 0) {
      const label = labelParts.join(' ');
      title = `${label} — Pièces détachées`;
      description = `Découvrez nos pièces détachées et accessoires ${label} : écrans, batteries, connecteurs. Livraison Chronopost 24h partout en France.`;
    }
  }

  return {
    title,
    description,
    // Les combinaisons de filtres (marque/gamme/modèle/type/recherche) génèrent de nombreuses URLs
    // différentes qui affichent des listes de produits très proches les unes des autres. Plutôt que
    // de laisser Google indexer chaque variante comme une page à part (dilution du référencement,
    // risque de contenu dupliqué), on désigne toujours /boutique (sans paramètres) comme version
    // canonique. Les pages /marque/[...] restent les vraies pages de catégorie à indexer.
    alternates: { canonical: `${SITE_URL}/boutique` },
  };
}

export default async function BoutiquePage({
  searchParams,
}: {
  searchParams: BoutiqueSearchParams;
}) {
  const [brands, lines, models] = await Promise.all([
    prisma.brand.findMany({ orderBy: { name: 'asc' } }),
    prisma.productLine.findMany({ orderBy: { name: 'asc' } }),
    prisma.model.findMany({ orderBy: { name: 'asc' } }),
  ]);

  const where: Record<string, unknown> = { showInBoutique: true };
  const modelFilter: Record<string, unknown> = {};

  if (searchParams.modele) {
    modelFilter.slug = searchParams.modele;
  }
  if (searchParams.gamme) {
    modelFilter.productLine = { slug: searchParams.gamme };
  }
  if (searchParams.marque) {
    modelFilter.productLine = {
      ...(modelFilter.productLine as object),
      brand: { slug: searchParams.marque },
    };
  }
  if (Object.keys(modelFilter).length > 0) {
    where.model = modelFilter;
  }
  if (searchParams.type) {
    where.pieceType = searchParams.type as PieceType;
  }
  const q = searchParams.q?.trim();
  if (q) {
    const normQ = normalizeModelQuery(q);
    const exactModelIds = normQ
      ? models.filter((m) => normalizeModelQuery(m.name) === normQ).map((m) => m.id)
      : [];

    if (exactModelIds.length > 0) {
      // Tier 1 : correspondance exacte à un modèle -> on ne montre que ce modèle, jamais ses
      // voisins au nom plus long (ex: "iPhone 16" ne doit pas remonter "iPhone 16 Pro Max").
      where.modelId = { in: exactModelIds };
    } else {
      // Tier 2 : repli sur une recherche mot par mot (voir tokenize/matchesWholeWord ci-dessus) —
      // chaque mot de la recherche doit apparaître quelque part dans le titre ou le nom du modèle,
      // peu importe l'ordre (ex: "verre trempé iphone 14" doit remonter "Verre trempé intégral
      // iPhone 14 Pro ...").
      const terms = tokenize(q);
      const candidates = await prisma.product.findMany({
        where: {
          AND: terms.map((t) => ({
            OR: [
              { title: { contains: t, mode: 'insensitive' } },
              { model: { name: { contains: t, mode: 'insensitive' } } },
            ],
          })),
        },
        select: { id: true, title: true, model: { select: { name: true } } },
      });
      where.id = {
        in: candidates
          .filter((p) =>
            terms.every((t) => matchesWholeWord(p.title, t) || matchesWholeWord(p.model.name, t))
          )
          .map((p) => p.id),
      };
    }
  }

  const totalCount = await prisma.product.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const requestedPage = parseInt(searchParams.page ?? '1', 10);
  const currentPage = Math.min(Math.max(1, Number.isNaN(requestedPage) ? 1 : requestedPage), totalPages);

  const [products, favoriteIds] = await Promise.all([
    prisma.product.findMany({
      where,
      include: { model: { include: { productLine: { include: { brand: true } } } } },
      orderBy: { title: 'asc' },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    getFavoriteProductIds(),
  ]);

  // Construit le lien vers une autre page en conservant tous les filtres actifs (marque, gamme,
  // modèle, type, recherche) — seul le paramètre "page" change.
  function buildPageHref(page: number) {
    const next = new URLSearchParams();
    if (searchParams.marque) next.set('marque', searchParams.marque);
    if (searchParams.gamme) next.set('gamme', searchParams.gamme);
    if (searchParams.modele) next.set('modele', searchParams.modele);
    if (searchParams.type) next.set('type', searchParams.type);
    if (searchParams.q) next.set('q', searchParams.q);
    if (page > 1) next.set('page', String(page));
    const qs = next.toString();
    return qs ? `/boutique?${qs}` : '/boutique';
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-6">
        {searchParams.q ? `Résultats pour "${searchParams.q}"` : 'Boutique — Pièces détachées'}
      </h1>
      <Filters brands={brands} lines={lines} models={models} />

      {products.length === 0 ? (
        <p className="text-gray-500">Aucune pièce ne correspond à ces filtres.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {products.map((p) => (
            <ProductCard
              key={p.id}
              favorited={favoriteIds.includes(p.id)}
              product={{
                id: p.id,
                slug: p.slug,
                title: p.title,
                price: Number(p.price),
                imageUrl: p.imageUrl,
                inStock: p.inStock,
                brandName: p.model.productLine.brand.name,
                modelName: p.model.name,
                avgRating: p.avgRating,
                reviewCount: p.reviewCount,
              }}
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-10">
          {currentPage > 1 ? (
            <Link
              href={buildPageHref(currentPage - 1)}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium hover:bg-gray-50"
            >
              ← Précédent
            </Link>
          ) : (
            <span className="px-4 py-2 rounded-lg border border-gray-100 text-sm font-medium text-gray-300">
              ← Précédent
            </span>
          )}

          <span className="text-sm text-gray-500">
            Page {currentPage} sur {totalPages} ({totalCount} produits)
          </span>

          {currentPage < totalPages ? (
            <Link
              href={buildPageHref(currentPage + 1)}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium hover:bg-gray-50"
            >
              Suivant →
            </Link>
          ) : (
            <span className="px-4 py-2 rounded-lg border border-gray-100 text-sm font-medium text-gray-300">
              Suivant →
            </span>
          )}
        </div>
      )}
    </div>
  );
}
