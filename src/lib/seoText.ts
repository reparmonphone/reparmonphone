import type { PieceType } from '@prisma/client';

// Libellé français (au singulier, minuscule, pour s'insérer dans une phrase) de chaque type de pièce
// — utilisé pour enrichir automatiquement les titres/descriptions SEO des fiches produit.
export const PIECE_TYPE_LABELS: Record<PieceType, string> = {
  ECRAN: 'écran',
  BATTERIE: 'batterie',
  NAPPE_CONNECTEUR: 'nappe / connecteur de charge',
  CAMERA: 'caméra',
  VITRE_ARRIERE: 'vitre arrière',
  CHASSIS: 'châssis',
  HAUT_PARLEUR: 'haut-parleur',
  VIBREUR: 'vibreur',
  BOUTON: 'bouton',
  OUTILLAGE: 'outil de réparation',
  ACCESSOIRE: 'accessoire',
  AUTRE: 'pièce détachée',
};

// Source unique pour le message de livraison rapide : à modifier ici seulement si jamais le délai ou
// le transporteur change, ça se répercute partout où ce message est utilisé.
export const DELIVERY_LINE = 'Livraison Chronopost 24h partout en France';

// Vrai si le texte mentionne déjà la livraison/le délai (pour ne jamais dupliquer le message quand
// Krys a elle-même écrit quelque chose à ce sujet dans sa description personnalisée).
function mentionsDelivery(text: string): boolean {
  return /livraison|chronopost|24\s*h\b|24h/i.test(text);
}

// Ajoute le message de livraison rapide à la fin d'un texte s'il n'y figure pas déjà, puis coupe à la
// longueur recommandée pour une meta description Google (~160 caractères) afin d'éviter une troncature
// disgracieuse dans les résultats de recherche.
export function withDeliveryMention(text: string, maxLength = 160): string {
  const trimmed = text.trim();
  const withDelivery = mentionsDelivery(trimmed) ? trimmed : `${trimmed} ${DELIVERY_LINE}.`;
  if (withDelivery.length <= maxLength) return withDelivery;
  // Si ça dépasse la limite, on préfère toujours garder le message de livraison entier (c'est le
  // point le plus important pour Krys) plutôt que de le couper — on raccourcit le texte d'origine à
  // la place.
  const budget = maxLength - DELIVERY_LINE.length - 2; // ". " final
  const shortened = trimmed.length > budget ? `${trimmed.slice(0, Math.max(0, budget - 1)).trim()}…` : trimmed;
  return mentionsDelivery(shortened) ? shortened : `${shortened} ${DELIVERY_LINE}.`;
}
