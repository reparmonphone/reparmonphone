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

// Pour un écran donné (identifié par le nom exact de son modèle, ex: "iPhone 14"), cherche le verre
// trempé qui correspond très précisément au même appareil, parmi les protections d'écran de la marque
// "Accessoires" (voir scripts/reclassify-protection-ecran-by-family.js). Retourne le moins cher des
// verres trouvés en stock, ou null si aucune correspondance fiable n'existe — on ne devine jamais.
export async function findScreenProtectorSuggestion(modelName: string): Promise<ScreenProtectorSuggestion | null> {
  const brand = await prisma.brand.findFirst({ where: { name: 'Accessoires' } });
  if (!brand) return null;

  const line = await prisma.productLine.findFirst({ where: { brandId: brand.id, slug: 'protection-ecran' } });
  if (!line) return null;

  const candidates = await prisma.product.findMany({
    where: { model: { productLineId: line.id }, showInBoutique: true, inStock: true },
    select: { id: true, slug: true, title: true, price: true, imageUrl: true },
  });

  const matches = candidates.filter((p) => matchesDeviceModel(p.title, modelName));
  if (matches.length === 0) return null;

  matches.sort((a, b) => Number(a.price) - Number(b.price));
  const best = matches[0];
  return { id: best.id, slug: best.slug, title: best.title, price: Number(best.price), imageUrl: best.imageUrl };
}
