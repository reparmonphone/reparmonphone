import { prisma } from '@/lib/prisma';
import { LANDING_PIECES, landingPieceByType, modelFullName, MIN_MODEL_PIECE_PRODUCTS } from '@/lib/landingPages';

// Données du « trouveur de pièce » de la page d'accueil : marque → gamme → modèle → pièce.
// On ne propose que ce qui existe réellement en boutique ET en stock, pour ne jamais mener à une page vide.

const TYPES = LANDING_PIECES.map((p) => p.type);
const STOCKED = { showInBoutique: true, inStock: true, pieceType: { in: [...TYPES] } };

export type FinderBrand = { slug: string; name: string; lines: { slug: string; name: string }[] };

export type FinderModel = {
  id: string; // Model.id
  slug: string;
  name: string; // nom complet (« Samsung Galaxy A52 »)
  pieces: {
    slug: string;
    type: string; // ECRAN, BATTERIE… (sert au devis)
    label: string; // « Écrans »
    singular: string; // « écran »
    count: number;
    minPrice: number; // prix de la pièce la moins chère en stock
    productSlug: string; // fiche de cette pièce
    href: string;
  }[];
  href: string; // page du modèle (toutes les pièces)
};

export async function getFinderBrands(): Promise<FinderBrand[]> {
  const lines = await prisma.productLine.findMany({
    where: { models: { some: { products: { some: STOCKED } } } },
    orderBy: { sortOrder: 'asc' },
    select: { slug: true, name: true, brand: { select: { slug: true, name: true } } },
  });
  const map = new Map<string, FinderBrand>();
  for (const l of lines) {
    // « Outils » (outillage) n'est pas une marque de téléphone : on ne l'affiche pas dans le trouveur.
    if (/outil/i.test(l.brand.slug) || /outil/i.test(l.brand.name)) continue;
    const b: FinderBrand = map.get(l.brand.slug) ?? { slug: l.brand.slug, name: l.brand.name, lines: [] };
    b.lines.push({ slug: l.slug, name: l.name });
    map.set(l.brand.slug, b);
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

export async function getFinderModels(brandSlug: string, lineSlug: string): Promise<FinderModel[]> {
  const line = await prisma.productLine.findFirst({
    where: { slug: lineSlug, brand: { slug: brandSlug } },
    select: { name: true, brand: { select: { name: true } } },
  });
  if (!line) return [];

  const models = await prisma.model.findMany({
    where: { productLine: { slug: lineSlug, brand: { slug: brandSlug } }, products: { some: STOCKED } },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, slug: true, name: true, products: { where: STOCKED, select: { pieceType: true, price: true, slug: true, title: true } } },
  });

  return models
    .map((m) => {
      const base = `/pieces-detachees/${brandSlug}/${lineSlug}/${m.slug}`;
      return {
        id: m.id,
        slug: m.slug,
        name: modelFullName(line.brand.name, line.name, m.name),
        pieces: buildPieces(base, m.products),
        href: base,
      };
    })
    // Un modèle qui n'a plus que des adhésifs/accessoires classés « écran » n'a plus aucune vraie pièce à proposer.
    .filter((m) => m.pieces.length > 0);
}

// Pièces en stock d'un modèle précis (page « Mes appareils »).
export async function getModelPieces(modelId: string) {
  const m = await prisma.model.findUnique({
    where: { id: modelId },
    select: {
      id: true,
      slug: true,
      name: true,
      productLine: { select: { slug: true, name: true, brand: { select: { slug: true, name: true } } } },
      products: { where: STOCKED, select: { pieceType: true, price: true, slug: true, title: true } },
    },
  });
  if (!m) return null;
  const line = m.productLine;
  const base = `/pieces-detachees/${line.brand.slug}/${line.slug}/${m.slug}`;
  return {
    id: m.id,
    brandName: line.brand.name,
    name: modelFullName(line.brand.name, line.name, m.name),
    href: base,
    pieces: buildPieces(base, m.products),
  };
}

type PieceRow = { pieceType: string; price: unknown; slug: string; title: string };

// Dans la catégorie « Écrans » de la boutique se trouvent aussi des adhésifs, joints, films de protection…
// Ce ne sont pas des écrans : ils ne doivent ni fixer le « dès X € » du devis, ni être proposés comme pièce.
const NOT_A_SCREEN = /adhesif|sticker|autocollant|double[ -]?face|joint|colle\b|ruban|scotch|film|verre tremp|protege|protection/;
const SCREEN_MIN_PRICE = 8; // un vrai écran de téléphone ne coûte jamais moins (garde-fou si le titre est atypique)

function isRealPart(p: PieceRow): boolean {
  if (p.pieceType !== 'ECRAN') return true;
  const title = p.title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return !NOT_A_SCREEN.test(title) && Number(p.price) >= SCREEN_MIN_PRICE;
}

function buildPieces(base: string, products: PieceRow[]): FinderModel['pieces'] {
  const counts = new Map<string, number>();
  const cheapest = new Map<string, { price: number; slug: string }>();
  for (const p of products.filter(isRealPart)) {
    counts.set(p.pieceType, (counts.get(p.pieceType) ?? 0) + 1);
    const price = Number(p.price);
    const cur = cheapest.get(p.pieceType);
    if (!cur || price < cur.price) cheapest.set(p.pieceType, { price, slug: p.slug });
  }
  return LANDING_PIECES.filter((lp) => (counts.get(lp.type) ?? 0) > 0).map((lp) => {
    const count = counts.get(lp.type) ?? 0;
    const best = cheapest.get(lp.type);
    return {
      slug: lp.slug,
      type: lp.type as string,
      label: lp.plural,
      singular: lp.singular,
      count,
      minPrice: best?.price ?? 0,
      productSlug: best?.slug ?? '',
      // Une page « modèle + pièce » avec un seul produit fait doublon : on renvoie alors vers la page du modèle.
      href: count >= MIN_MODEL_PIECE_PRODUCTS ? `${base}/${lp.slug}` : base,
    };
  });
}

export { landingPieceByType };
