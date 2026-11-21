// Localisation d'une adresse de livraison (carte des commandes). Côté serveur uniquement.
//  - France (métropole et Outre-mer) : service de géocodage officiel de l'État (Géoplateforme de l'IGN, ex « API Adresse »).
//    Gratuit, sans clé, hébergé en France ; l'ancienne adresse api-adresse.data.gouv.fr est essayée en secours.
//  - Étranger (et Monaco) : Nominatim, le service de recherche d'OpenStreetMap (1 requête par seconde au maximum).
// Seule l'adresse (rue, code postal, ville, pays) est envoyée : jamais le nom, l'e-mail ni le téléphone du client.

export type GeoPrecision = 'adresse' | 'rue' | 'ville';
export type GeoResult = { lat: number; lon: number; p: GeoPrecision };

const FR_ENDPOINTS = ['https://data.geopf.fr/geocodage/search/', 'https://api-adresse.data.gouv.fr/search/'];
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const ROAD_TYPES = new Set(['road', 'street', 'highway', 'footway', 'path', 'residential']);
const BUILDING_TYPES = new Set(['house', 'building', 'apartments', 'amenity', 'shop', 'office', 'tourism', 'leisure', 'craft', 'man_made', 'place']);
const UA = 'ReparMonPhone-admin/1.0 (contact@reparmonphone.fr)';

const clean = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
const validCoord = (lat: unknown, lon: unknown): lat is number =>
  typeof lat === 'number' && typeof lon === 'number' && Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;

async function getJson(url: string, headers: Record<string, string> = {}): Promise<unknown> {
  const res = await fetch(url, { headers: { Accept: 'application/json', ...headers }, signal: AbortSignal.timeout(5000), cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

type FrFeature = { geometry?: { coordinates?: number[] }; properties?: { score?: number; type?: string } };

async function frSearch(params: Record<string, string>): Promise<FrFeature | null> {
  const qs = new URLSearchParams({ ...params, limit: '1' }).toString();
  for (const base of FR_ENDPOINTS) {
    try {
      const json = (await getJson(`${base}?${qs}`)) as { features?: FrFeature[] };
      return json.features?.[0] ?? null;
    } catch {
      // service indisponible : on essaie le suivant
    }
  }
  return null;
}

const fromFeature = (f: FrFeature | null, p: GeoPrecision): GeoResult | null => {
  const [lon, lat] = f?.geometry?.coordinates ?? [];
  return validCoord(lat, lon) ? { lat, lon, p } : null;
};

export async function geocodeFrance(line1: string, zip: string, city: string): Promise<GeoResult | null> {
  const l1 = clean(line1);
  const z = clean(zip);
  const c = clean(city);
  if (l1 && l1 !== 'À compléter') {
    const f = await frSearch({ q: `${l1} ${z} ${c}`, postcode: z });
    const score = f?.properties?.score ?? 0;
    const type = f?.properties?.type;
    // On n'accepte une position « à l'adresse » que si le service est assez sûr de lui.
    if (f && score >= 0.5) {
      if (type === 'housenumber') return fromFeature(f, 'adresse');
      if (type === 'street') return fromFeature(f, 'rue');
    }
  }
  // Repli : le centre de la commune (position approximative, signalée comme telle sur la carte)
  const m = await frSearch({ q: c || z, postcode: z, type: 'municipality' });
  return fromFeature(m, 'ville');
}

export async function geocodeForeign(line1: string, zip: string, city: string, country: string, countryCode: string): Promise<GeoResult | null> {
  const cc = countryCode.toLowerCase();
  const search = async (q: string, p: GeoPrecision): Promise<GeoResult | null> => {
    try {
      const qs = new URLSearchParams({ format: 'jsonv2', q, limit: '1', countrycodes: cc }).toString();
      const arr = (await getJson(`${NOMINATIM}?${qs}`, { 'User-Agent': UA, 'Accept-Language': 'fr' })) as { lat?: string; lon?: string; addresstype?: string }[];
      const r = arr?.[0];
      const lat = Number(r?.lat);
      const lon = Number(r?.lon);
      if (!validCoord(lat, lon)) return null;
      // La précision réelle dépend de ce que Nominatim a trouvé, pas de ce qu'on lui a demandé.
      const t = r?.addresstype ?? '';
      const found: GeoPrecision = ROAD_TYPES.has(t) ? 'rue' : BUILDING_TYPES.has(t) ? 'adresse' : 'ville';
      return { lat, lon, p: p === 'ville' ? 'ville' : found };
    } catch {
      return null;
    }
  };
  const l1 = clean(line1);
  const rest = `${clean(zip)} ${clean(city)}`.trim();
  if (l1 && l1 !== 'À compléter') {
    const r = await search(`${l1}, ${rest}, ${country}`, 'adresse');
    if (r) return r;
    await new Promise((res) => setTimeout(res, 1100)); // règle d'usage de Nominatim : 1 requête / seconde
  }
  return search(`${rest}, ${country}`, 'ville');
}
