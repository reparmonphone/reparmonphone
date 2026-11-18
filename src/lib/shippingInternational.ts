// Livraison à l'étranger (Union européenne) : un petit jeu d'options à tarif fixe (ex. lettre suivie 9,90 €,
// Colissimo 13,90 €) proposé dès que le client choisit un pays autre que la France dans son panier.
// La France comprend la métropole ET l'Outre-mer : ceux-ci restent gérés par les zones de /admin/livraison
// (code postal), exactement comme avant.
//
// Réglages dans /admin/livraison (carte « Livraison à l'étranger »), stockés dans site_settings (clé
// « shipping_international ») — aucune migration de base. Ce fichier est « pur » (aucun accès base) pour être
// utilisable côté navigateur (panier) comme côté serveur (routes de paiement) ; la lecture en base est dans
// shippingInternationalServer.ts.

import { DOMTOM_STRIPE_COUNTRY_CODES } from '@/lib/shippingCountryCodes';

export const INTERNATIONAL_SETTING_KEY = 'shipping_international';

// Les 26 autres pays de l'Union européenne (la France est gérée à part).
export const EU_COUNTRIES: { code: string; name: string }[] = [
  { code: 'DE', name: 'Allemagne' },
  { code: 'AT', name: 'Autriche' },
  { code: 'BE', name: 'Belgique' },
  { code: 'BG', name: 'Bulgarie' },
  { code: 'CY', name: 'Chypre' },
  { code: 'HR', name: 'Croatie' },
  { code: 'DK', name: 'Danemark' },
  { code: 'ES', name: 'Espagne' },
  { code: 'EE', name: 'Estonie' },
  { code: 'FI', name: 'Finlande' },
  { code: 'GR', name: 'Grèce' },
  { code: 'HU', name: 'Hongrie' },
  { code: 'IE', name: 'Irlande' },
  { code: 'IT', name: 'Italie' },
  { code: 'LV', name: 'Lettonie' },
  { code: 'LT', name: 'Lituanie' },
  { code: 'LU', name: 'Luxembourg' },
  { code: 'MT', name: 'Malte' },
  { code: 'NL', name: 'Pays-Bas' },
  { code: 'PL', name: 'Pologne' },
  { code: 'PT', name: 'Portugal' },
  { code: 'CZ', name: 'Tchéquie' },
  { code: 'RO', name: 'Roumanie' },
  { code: 'SK', name: 'Slovaquie' },
  { code: 'SI', name: 'Slovénie' },
  { code: 'SE', name: 'Suède' },
];

export type IntlOption = { id: string; label: string; description: string; price: number; enabled: boolean };

export type InternationalConfig = {
  enabled: boolean;
  countries: string[]; // codes ISO des pays ouverts à la livraison
  options: IntlOption[];
};

// Ce que le panier reçoit : seulement ce qui est réellement proposé.
export type InternationalPublic = {
  enabled: boolean;
  countries: { code: string; name: string }[];
  options: { id: string; label: string; description: string; price: number }[];
};

export const DEFAULT_INTERNATIONAL: InternationalConfig = {
  enabled: true,
  countries: EU_COUNTRIES.map((c) => c.code),
  options: [
    { id: 'intl-lettre', label: 'Lettre suivie internationale – La Poste', description: 'Livraison à l’étranger, avec suivi', price: 9.9, enabled: true },
    { id: 'intl-colissimo', label: 'Colissimo International', description: 'Livraison à l’étranger, avec suivi', price: 13.9, enabled: true },
  ],
};

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export function normalizeInternational(raw: unknown): InternationalConfig {
  const r = (raw && typeof raw === 'object' ? raw : null) as Record<string, unknown> | null;
  if (!r) return DEFAULT_INTERNATIONAL;
  const known = new Set(EU_COUNTRIES.map((c) => c.code));
  const countries = Array.isArray(r.countries)
    ? Array.from(new Set(r.countries.map((c) => String(c).toUpperCase()).filter((c) => known.has(c))))
    : DEFAULT_INTERNATIONAL.countries;
  const rawOptions = Array.isArray(r.options) ? (r.options as Record<string, unknown>[]) : [];
  const options = DEFAULT_INTERNATIONAL.options.map((d) => {
    const o = rawOptions.find((x) => x && x.id === d.id);
    if (!o) return d;
    const price = Number(String(o.price).replace(',', '.'));
    return {
      id: d.id,
      label: str(o.label, 80) || d.label,
      description: typeof o.description === 'string' ? str(o.description, 120) : d.description,
      price: Number.isFinite(price) && price >= 0 && price <= 500 ? Math.round(price * 100) / 100 : d.price,
      enabled: o.enabled !== false,
    };
  });
  return { enabled: r.enabled !== false, countries, options };
}

// Version publique : rien n'est proposé si la livraison à l'étranger est coupée, sans pays ou sans option.
export function toPublicInternational(c: InternationalConfig): InternationalPublic {
  const countries = EU_COUNTRIES.filter((x) => c.countries.includes(x.code));
  const options = c.options.filter((o) => o.enabled).map(({ id, label, description, price }) => ({ id, label, description, price }));
  const enabled = c.enabled && countries.length > 0 && options.length > 0;
  return { enabled, countries: enabled ? countries : [], options: enabled ? options : [] };
}

const DOMESTIC = new Set<string>(['FR', ...DOMTOM_STRIPE_COUNTRY_CODES]);
export const isDomesticCountry = (code: string | null | undefined) => !code || DOMESTIC.has(code.toUpperCase());

export function countryName(code: string | null | undefined): string {
  const c = (code ?? '').toUpperCase();
  return EU_COUNTRIES.find((x) => x.code === c)?.name ?? c;
}

// Ajoute le pays à la ville pour les adresses hors de France (« Bruxelles (Belgique) ») : il s'affiche ainsi
// partout où l'adresse est imprimée (admin, facture, e-mails, étiquettes) sans rien changer d'autre.
export function cityWithCountry(city: string, code: string | null | undefined): string;
export function cityWithCountry(city: string | null | undefined, code: string | null | undefined): string | undefined;
export function cityWithCountry(city: string | null | undefined, code: string | null | undefined): string | undefined {
  if (city == null) return undefined;
  if (isDomesticCountry(code)) return city;
  const name = countryName(code);
  return city.includes(`(${name})`) ? city : `${city} (${name})`;
}

// Inverse : retrouve le pays étranger écrit à la fin d'une ville (null pour une adresse en France).
export function foreignCountryFromCity(city: string | null | undefined): string | null {
  const m = /\(([^()]+)\)\s*$/.exec(city ?? '');
  if (!m) return null;
  return EU_COUNTRIES.some((c) => c.name === m[1]) ? m[1] : null;
}

type CustomerCountries = { shipDifferent?: unknown; addressCountry?: unknown; shipAddressCountry?: unknown };
const code2 = (v: unknown) => (typeof v === 'string' && /^[A-Za-z]{2}$/.test(v.trim()) ? v.trim().toUpperCase() : 'FR');

// Pays de livraison réel d'une commande : celui de l'adresse de livraison si elle diffère de la facturation.
export function deliveryCountry(customer: CustomerCountries | null | undefined): string {
  if (!customer) return 'FR';
  return customer.shipDifferent ? code2(customer.shipAddressCountry) : code2(customer.addressCountry);
}
export const billingCountry = (customer: CustomerCountries | null | undefined) => code2(customer?.addressCountry);

// Contrôle serveur d'une livraison à l'étranger : pays ouvert + option réellement proposée → prix du réglage.
export function resolveInternationalShipping(
  config: InternationalConfig,
  countryCode: string,
  optionId: unknown
): { ok: true; label: string; price: number } | { ok: false; error: string } {
  const pub = toPublicInternational(config);
  if (!pub.enabled) return { ok: false, error: 'La livraison à l’étranger n’est pas disponible pour le moment.' };
  if (!pub.countries.some((c) => c.code === countryCode)) {
    return { ok: false, error: 'Nous ne livrons pas encore dans ce pays. Contactez-nous pour une solution adaptée.' };
  }
  const opt = pub.options.find((o) => o.id === optionId);
  if (!opt) return { ok: false, error: 'Cette option de livraison n’est pas disponible pour cette destination.' };
  return { ok: true, label: opt.label, price: opt.price };
}
