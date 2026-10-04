import { prisma } from '@/lib/prisma';
import type { PieceType } from '@prisma/client';

// Pages d'atterrissage SEO "pièce + marque/gamme" (ex: /pieces-detachees/apple/iphone/ecrans), pensées pour
// capter les recherches générales à l'échelle de la France (« écran iPhone », « batterie Galaxy »...) que ni
// les fiches produit (trop précises) ni la boutique filtrée (canonique vers /boutique) ne ciblent.

export type LandingPiece = {
  slug: string; // segment d'URL
  type: PieceType;
  singular: string; // "écran"
  plural: string; // "Écrans" (en tête de titre)
  lower: string; // "écrans"
  advice: string; // conseil de choix, factuel et générique
};

export const LANDING_PIECES: LandingPiece[] = [
  { slug: 'ecrans', type: 'ECRAN', singular: 'écran', plural: 'Écrans', lower: 'écrans', advice: 'Vérifie la référence exacte de ton modèle avant de commander : un écran n\'est jamais compatible avec toute une gamme. Les écrans de qualité origine offrent la meilleure fidélité d\'affichage ; les compatibles sont plus économiques pour un usage courant.' },
  { slug: 'batteries', type: 'BATTERIE', singular: 'batterie', plural: 'Batteries', lower: 'batteries', advice: 'Choisis la batterie correspondant exactement à ton modèle. Une batterie neuve redonne de l\'autonomie à un téléphone qui se décharge vite ; pense à la faire poser avec soin et à vérifier que la nouvelle ne gonfle pas.' },
  { slug: 'connecteurs-de-charge', type: 'NAPPE_CONNECTEUR', singular: 'nappe / connecteur de charge', plural: 'Connecteurs de charge', lower: 'connecteurs de charge', advice: 'Si ton téléphone charge mal ou plus du tout, un connecteur de charge usé en est souvent la cause. Vérifie d\'abord que le port n\'est pas simplement encrassé, puis commande la nappe adaptée à ton modèle.' },
  { slug: 'cameras', type: 'CAMERA', singular: 'caméra', plural: 'Caméras', lower: 'caméras', advice: 'Repère s\'il s\'agit de la caméra arrière ou avant, puis commande le module correspondant à ton modèle exact.' },
  { slug: 'vitres-arrieres', type: 'VITRE_ARRIERE', singular: 'vitre arrière', plural: 'Vitres arrière', lower: 'vitres arrière', advice: 'Le remplacement d\'une vitre arrière demande de chauffer et décoller l\'ancienne : c\'est plus délicat qu\'un changement de batterie. Prends la référence exacte de ton modèle, et la bonne couleur.' },
  { slug: 'haut-parleurs', type: 'HAUT_PARLEUR', singular: 'haut-parleur', plural: 'Haut-parleurs', lower: 'haut-parleurs', advice: 'Si le son grésille ou disparaît, distingue l\'écouteur d\'appel du haut-parleur externe, puis commande la pièce correspondant à ton modèle.' },
  { slug: 'vibreurs', type: 'VIBREUR', singular: 'vibreur', plural: 'Vibreurs', lower: 'vibreurs', advice: 'Un vibreur qui ne fonctionne plus se remplace facilement sur la plupart des modèles. Commande la référence adaptée à ton téléphone.' },
  { slug: 'boutons', type: 'BOUTON', singular: 'bouton', plural: 'Boutons', lower: 'boutons', advice: 'Identifie le bouton concerné (power, volume, accueil) et commande la nappe ou le bouton adapté à ton modèle.' },
  { slug: 'chassis', type: 'CHASSIS', singular: 'châssis', plural: 'Châssis', lower: 'châssis', advice: 'Le châssis est la pièce la plus délicate à remplacer, car tous les composants doivent être transférés. Assure-toi de choisir le bon modèle et la bonne couleur.' },
];

export function landingPieceBySlug(slug: string): LandingPiece | undefined {
  return LANDING_PIECES.find((p) => p.slug === slug);
}
export function landingPieceByType(type: PieceType): LandingPiece | undefined {
  return LANDING_PIECES.find((p) => p.type === type);
}

// En dessous de ce nombre de produits, la page existe mais reste en "noindex" et hors sitemap : une page
// d'atterrissage presque vide est un contenu pauvre qui peut nuire au référencement du reste du site.
export const MIN_INDEXABLE_PRODUCTS = 3;

export type LandingCombo = {
  brandSlug: string;
  brandName: string;
  lineSlug: string;
  lineName: string;
  type: PieceType;
  count: number;
};

// Toutes les combinaisons marque/gamme/pièce qui ont au moins un produit en boutique, avec leur nombre de
// produits. Sert au sitemap et à la page d'index /pieces-detachees.
export async function getLandingCombos(): Promise<LandingCombo[]> {
  const rows = await prisma.product.findMany({
    where: { showInBoutique: true, pieceType: { in: [...LANDING_PIECES.map((p) => p.type)] } },
    select: {
      pieceType: true,
      model: { select: { productLine: { select: { slug: true, name: true, brand: { select: { slug: true, name: true } } } } } },
    },
  });

  const map = new Map<string, LandingCombo>();
  for (const r of rows) {
    const line = r.model.productLine;
    const key = `${line.brand.slug}/${line.slug}/${r.pieceType}`;
    const existing = map.get(key);
    if (existing) existing.count += 1;
    else
      map.set(key, {
        brandSlug: line.brand.slug,
        brandName: line.brand.name,
        lineSlug: line.slug,
        lineName: line.name,
        type: r.pieceType,
        count: 1,
      });
  }
  return Array.from(map.values());
}
