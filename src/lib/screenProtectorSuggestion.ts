import { prisma } from '@/lib/prisma';

export type ScreenProtectorSuggestion = {
  id: string;
  slug: string;
  title: string;
  price: number;
  imageUrl: string | null;
};

// Le nom du modèle ne doit jamais être suggéré s'il est immédiatement suivi, dans le titre candidat,
// d'un qualificatif qui désigne un AUTRE modèle plus précis (ex: chercher "iPhone 14" ne doit jamais
// proposer un verre trempé pour "iPhone 14 Pro Max", ni pour "iPhone 14 Plus") — mieux vaut ne rien
// proposer que proposer le mauvais accessoire. Même principe de limite de mot que la recherche du site
// (src/app/api/search/route.ts), étendu pour aussi bloquer les qualificatifs collés au modèle.
function matchesDeviceModel(title: string, modelName: string): boolean {
  const escaped = modelName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(^|[^a-z0-9])${escaped}(?![a-z0-9]|\\s*(pro|plus|max|mini|ultra|\\+|e\\b))`, 'i');
  return re.test(title);
}

// Un titre "Verre Trempé (Lot x25) iPhone 13..." vend 25 verres d'un coup — pratique pour un
// professionnel, mais un client qui vient de casser SON écran veut presque toujours une seule pièce.
// On classe donc les lots après les unités, jamais avant, dans la liste proposée.
function isBulkPack(title: string): boolean {
  return /\blot\b/i.test(title);
}

const MAX_SUGGESTIONS = 3;

// Pour un écran donné (identifié par le nom exact de son modèle, ex: "iPhone 14"), cherche jusqu'à
// MAX_SUGGESTIONS verres trempés qui correspondent très précisément au même appareil, parmi les
// protections d'écran de la marque "Accessoires" (voir scripts/reclassify-protection-ecran-by-family.js).
// Les ventes à l'unité passent toujours avant les lots multiples, puis du moins cher au plus cher.
// Retourne un tableau vide si aucune correspondance fiable n'existe — on ne devine jamais.
export async function findScreenProtectorSuggestions(modelName: string): Promise<ScreenProtectorSuggestion[]> {
  const brand = await prisma.brand.findFirst({ where: { name: 'Accessoires' } });
  if (!brand) return [];

  const line = await prisma.productLine.findFirst({ where: { brandId: brand.id, slug: 'protection-ecran' } });
  if (!line) return [];

  const candidates = await prisma.product.findMany({
    where: { model: { productLineId: line.id }, showInBoutique: true, inStock: true },
    select: { id: true, slug: true, title: true, price: true, imageUrl: true },
  });

  const matches = candidates.filter((p) => matchesDeviceModel(p.title, modelName));
  if (matches.length === 0) return [];

  matches.sort((a, b) => {
    const bulkDiff = Number(isBulkPack(a.title)) - Number(isBulkPack(b.title));
    if (bulkDiff !== 0) return bulkDiff;
    return Number(a.price) - Number(b.price);
  });

  return matches.slice(0, MAX_SUGGESTIONS).map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    price: Number(p.price),
    imageUrl: p.imageUrl,
  }));
}
