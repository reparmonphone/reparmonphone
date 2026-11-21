// Répartition géographique des commandes (carte de l'admin). Fichier « pur » : aucun accès base, utilisable côté
// serveur (agrégation) comme côté navigateur (carte).
//
// Une commande n'a pas de colonne « pays » : on la localise avec son adresse de LIVRAISON.
//  - ville terminée par « (Belgique) » → commande à l'étranger (voir shippingInternational.ts) ;
//  - sinon le code postal donne le département (Corse, Outre-mer et Monaco compris) ;
//  - sinon la commande est classée « non localisée ».

import { EU_COUNTRIES, foreignCountryFromCity } from '@/lib/shippingInternational';

export type StatusGroup = 'valid' | 'refunded' | 'cancelled';
export const GROUPS: StatusGroup[] = ['valid', 'refunded', 'cancelled'];

export const GROUP_LABELS: Record<StatusGroup, string> = {
  valid: 'Valides',
  refunded: 'Remboursées',
  cancelled: 'Annulées',
};
export const GROUP_ICONS: Record<StatusGroup, string> = { valid: '✅', refunded: '↩️', cancelled: '❌' };
export const GROUP_COLORS: Record<StatusGroup, string> = { valid: '#16a34a', refunded: '#d97706', cancelled: '#dc2626' };

// « Valides » = commandes réellement payées (comme dans la page Statistiques). Les paniers non payés (PENDING)
// ne sont pas de vraies commandes : ils n'apparaissent pas sur la carte.
export function statusGroup(status: string): StatusGroup | null {
  if (status === 'PAID' || status === 'PROCESSING' || status === 'SHIPPED' || status === 'DELIVERED') return 'valid';
  if (status === 'REFUNDED') return 'refunded';
  if (status === 'CANCELLED') return 'cancelled';
  return null;
}

export type Bucket = { n: number; sum: number };
export type Cell = Record<StatusGroup, Bucket>;
export type GeoAgg = {
  france: Record<string, Cell>; // clé : code département (« 83 », « 2A », « 974 »…)
  countries: Record<string, Cell>; // clé : code pays ISO en majuscules ; « FR » = métropole + Outre-mer
  unknown: Cell;
};

export const emptyCell = (): Cell => ({
  valid: { n: 0, sum: 0 },
  refunded: { n: 0, sum: 0 },
  cancelled: { n: 0, sum: 0 },
});
export const emptyAgg = (): GeoAgg => ({ france: {}, countries: {}, unknown: emptyCell() });

export type PeriodKey = 'all' | '365' | '90' | '30';
export const PERIODS: { key: PeriodKey; label: string; days: number | null }[] = [
  { key: 'all', label: 'Depuis le début', days: null },
  { key: '365', label: '12 mois', days: 365 },
  { key: '90', label: '90 jours', days: 90 },
  { key: '30', label: '30 jours', days: 30 },
];

export const OUTRE_MER_ZONES: { code: string; name: string }[] = [
  { code: '971', name: 'Guadeloupe' },
  { code: '972', name: 'Martinique' },
  { code: '973', name: 'Guyane' },
  { code: '974', name: 'La Réunion' },
  { code: '976', name: 'Mayotte' },
  { code: '975', name: 'Saint-Pierre-et-Miquelon' },
  { code: '977', name: 'Saint-Barthélemy' },
  { code: '978', name: 'Saint-Martin' },
  { code: '986', name: 'Wallis-et-Futuna' },
  { code: '987', name: 'Polynésie française' },
  { code: '988', name: 'Nouvelle-Calédonie' },
];
const OUTRE_MER_CODES = new Set(OUTRE_MER_ZONES.map((z) => z.code));

export type Place = { kind: 'fr'; code: string } | { kind: 'country'; code: string } | { kind: 'unknown' };

export function locateOrder(zip: string | null | undefined, city: string | null | undefined): Place {
  const foreign = foreignCountryFromCity(city);
  if (foreign) {
    const c = EU_COUNTRIES.find((x) => x.name === foreign);
    return c ? { kind: 'country', code: c.code } : { kind: 'unknown' };
  }
  const z = (zip || '').replace(/\s/g, '');
  if (!/^\d{5}$/.test(z)) return { kind: 'unknown' };
  if (z === '98000') return { kind: 'country', code: 'MC' }; // Monaco
  if (z.startsWith('20')) return { kind: 'fr', code: Number(z.slice(0, 3)) <= 201 ? '2A' : '2B' };
  const dom = z.slice(0, 3);
  if (OUTRE_MER_CODES.has(dom)) return { kind: 'fr', code: dom };
  const n = Number(z.slice(0, 2));
  if (n >= 1 && n <= 95) return { kind: 'fr', code: z.slice(0, 2) };
  return { kind: 'unknown' };
}

function bump(map: Record<string, Cell>, key: string, group: StatusGroup, total: number) {
  const cell = (map[key] ??= emptyCell());
  cell[group].n += 1;
  cell[group].sum += total;
}

export function addToAgg(agg: GeoAgg, place: Place, group: StatusGroup, total: number) {
  if (place.kind === 'fr') {
    bump(agg.france, place.code, group, total);
    bump(agg.countries, 'FR', group, total);
  } else if (place.kind === 'country') {
    bump(agg.countries, place.code, group, total);
  } else {
    agg.unknown[group].n += 1;
    agg.unknown[group].sum += total;
  }
}

export type OrderGeoRow = { status: string; total: number; zip: string | null; city: string | null; createdAt: Date };

// Une répartition par période (toutes, 12 mois, 90 jours, 30 jours) : le navigateur choisit celle à afficher.
export function aggregateByPeriod(rows: OrderGeoRow[], now: Date = new Date()): Record<PeriodKey, GeoAgg> {
  const out = { all: emptyAgg(), '365': emptyAgg(), '90': emptyAgg(), '30': emptyAgg() } as Record<PeriodKey, GeoAgg>;
  for (const r of rows) {
    const g = statusGroup(r.status);
    if (!g) continue;
    const place = locateOrder(r.zip, r.city);
    const ageDays = (now.getTime() - r.createdAt.getTime()) / 86_400_000;
    for (const p of PERIODS) {
      if (p.days === null || ageDays <= p.days) addToAgg(out[p.key], place, g, r.total);
    }
  }
  return out;
}

// Une commande placée sur la carte précise (OpenStreetMap).
export type GeoPoint = {
  id: string; // identifiant de la commande
  n: number; // numéro de facture
  g: StatusGroup;
  t: number; // montant TTC
  d: string; // date (ISO)
  c: string; // ville affichée
  lat: number;
  lon: number;
  p: 'adresse' | 'rue' | 'ville'; // précision de la position
};

export const PRECISION_LABELS: Record<GeoPoint['p'], string> = {
  adresse: 'Position à l’adresse',
  rue: 'Position dans la rue',
  ville: 'Centre de la ville (adresse introuvable)',
};
