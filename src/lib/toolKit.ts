import { prisma } from '@/lib/prisma';

// « Kit outils » proposé sur une fiche pièce : à partir de la liste d'outils d'un guide de réparation
// (RepairGuide.toolsNeeded, ex. « Tournevis Pentalobe P2 »), on cherche dans la boutique les produits
// OUTILLAGE en stock qui correspondent. Si rien ne correspond, aucun kit n'est affiché.

export type ToolKitItem = {
  id: string;
  slug: string;
  title: string;
  price: number;
  imageUrl: string | null;
  forTool: string; // nom de l'outil du guide auquel ce produit répond
};

const STOP = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'un', 'une', 'et', 'pour', 'avec', 'en', 'au', 'aux']);

function words(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(' ')
    .filter((w) => w.length > 2 && !STOP.has(w));
}

// Mot-clé de chaque type de pièce dans le titre d'un guide (pour choisir le bon guide).
const GUIDE_KEYWORDS: Record<string, string[]> = {
  ECRAN: ['ecran', 'vitre', 'dalle'],
  BATTERIE: ['batterie'],
  NAPPE_CONNECTEUR: ['connecteur', 'charge', 'nappe'],
  CAMERA: ['camera', 'appareil photo'],
  VITRE_ARRIERE: ['vitre arriere', 'face arriere', 'dos'],
  CHASSIS: ['chassis', 'coque'],
  HAUT_PARLEUR: ['haut parleur', 'haut-parleur', 'ecouteur'],
  VIBREUR: ['vibreur', 'taptic'],
  BOUTON: ['bouton'],
};

// Choisit, parmi les guides du modèle, celui qui correspond au type de la pièce (sinon le plus consulté).
export function pickGuide<T extends { title: string }>(guides: T[], pieceType: string): T | null {
  if (guides.length === 0) return null;
  const keys = GUIDE_KEYWORDS[pieceType] ?? [];
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/-/g, ' ');
  const hit = guides.find((g) => keys.some((k) => norm(g.title).includes(norm(k))));
  return hit ?? guides[0];
}

export async function findToolKit(toolsNeeded: string[], excludeProductId: string): Promise<ToolKitItem[]> {
  const kit: ToolKitItem[] = [];
  const seen = new Set<string>([excludeProductId]);

  for (const tool of toolsNeeded.slice(0, 6)) {
    const ws = words(tool);
    if (ws.length === 0) continue;

    const base = { pieceType: 'OUTILLAGE' as const, inStock: true, showInBoutique: true };
    // 1) tous les mots du nom de l'outil ; 2) à défaut, le mot le plus long (le plus distinctif).
    const attempts = [ws, [[...ws].sort((a, b) => b.length - a.length)[0]]];

    for (const attempt of attempts) {
      const found = await prisma.product.findFirst({
        where: {
          ...base,
          id: { notIn: Array.from(seen) },
          AND: attempt.map((w) => ({ title: { contains: w, mode: 'insensitive' as const } })),
        },
        orderBy: { price: 'asc' },
        select: { id: true, slug: true, title: true, price: true, imageUrl: true },
      });
      if (found) {
        seen.add(found.id);
        kit.push({
          id: found.id,
          slug: found.slug,
          title: found.title,
          price: Number(found.price),
          imageUrl: found.imageUrl,
          forTool: tool,
        });
        break;
      }
    }
    if (kit.length >= 4) break;
  }
  return kit;
}
