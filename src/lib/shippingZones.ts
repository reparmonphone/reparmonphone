// Détection de la zone de livraison à partir du code postal, et calcul du tarif effectif.
// Utilisé à la fois côté client (panier, pour afficher le prix qui s'ajuste en direct) et côté
// serveur (les 3 routes de paiement — Stripe/SumUp/PayPal — pour calculer le montant RÉEL facturé,
// sans jamais faire confiance au prix affiché côté client).
//
// Principe : chaque ShippingZone a une liste de préfixes de code postal (ex: "973" pour la Guyane).
// On prend les 3 premiers chiffres du code postal saisi et on cherche une zone correspondante. Si
// aucune zone ne correspond (cas normal : France métropolitaine), on retombe sur le prix de base de
// la ShippingOption — comportement strictement identique à avant l'ajout de cette fonctionnalité.

export type ShippingZoneData = {
  id: string;
  name: string;
  postalPrefixes: string[];
};

export type ShippingZoneRateData = {
  shippingOptionId: string;
  zoneId: string;
  price: number;
};

function normalizePostalCode(postalCode: string | null | undefined): string {
  return (postalCode ?? '').replace(/\s+/g, '').toUpperCase();
}

// Trouve la zone correspondant à un code postal donné, en comparant ses préfixes (préfixe le plus
// long en priorité, pour permettre plus tard des zones plus précises si besoin, ex: "97133" avant "971").
export function findShippingZone(zones: ShippingZoneData[], postalCode: string | null | undefined): ShippingZoneData | null {
  const normalized = normalizePostalCode(postalCode);
  if (!normalized) return null;

  let best: { zone: ShippingZoneData; prefixLength: number } | null = null;
  for (const zone of zones) {
    for (const prefix of zone.postalPrefixes) {
      const cleanPrefix = prefix.trim();
      if (!cleanPrefix) continue;
      if (normalized.startsWith(cleanPrefix) && (!best || cleanPrefix.length > best.prefixLength)) {
        best = { zone, prefixLength: cleanPrefix.length };
      }
    }
  }
  return best?.zone ?? null;
}

// Calcule le prix effectif d'une option de livraison pour un code postal donné : le tarif de zone
// spécifique s'il existe, sinon le tarif de base (France métropolitaine).
export function resolveShippingPrice(
  option: { id: string; price: number },
  zones: ShippingZoneData[],
  rates: ShippingZoneRateData[],
  postalCode: string | null | undefined
): { price: number; zone: ShippingZoneData | null } {
  const zone = findShippingZone(zones, postalCode);
  if (!zone) return { price: option.price, zone: null };

  const rate = rates.find((r) => r.shippingOptionId === option.id && r.zoneId === zone.id);
  if (!rate) return { price: option.price, zone };

  return { price: rate.price, zone };
}

export type ShippingOptionZoneLinkData = {
  shippingOptionId: string;
  zoneId: string;
};

// Une option de livraison est-elle proposée pour la zone résolue (ou pour la France métropolitaine si
// zone === null, cas normal quand le code postal saisi ne correspond à aucune ShippingZone) ? Utilisé à
// la fois côté client (masquer les options non pertinentes dans le panier) et côté serveur (rejeter une
// tentative de payer avec une option qui n'est pas censée être proposée pour cette destination).
export function isShippingOptionAvailable(
  option: { id: string; availableMetropole: boolean },
  zone: ShippingZoneData | null,
  optionZoneLinks: ShippingOptionZoneLinkData[]
): boolean {
  if (!zone) return option.availableMetropole;
  return optionZoneLinks.some((l) => l.shippingOptionId === option.id && l.zoneId === zone.id);
}

// Préfixes de code postal des départements et collectivités d'Outre-mer français — utilisés pour
// pré-remplir la zone créée par scripts/seed-shipping-zone-domtom.js. Krys peut ensuite ajuster
// cette liste (ou en créer d'autres, ex: Corse) directement depuis /admin/livraison.
export const DOMTOM_POSTAL_PREFIXES = [
  '971', // Guadeloupe
  '972', // Martinique
  '973', // Guyane
  '974', // Réunion
  '975', // Saint-Pierre-et-Miquelon
  '976', // Mayotte
  '977', // Saint-Barthélemy
  '978', // Saint-Martin
  '986', // Wallis-et-Futuna
  '987', // Polynésie française
  '988', // Nouvelle-Calédonie
];
