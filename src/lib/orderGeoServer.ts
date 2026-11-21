import { prisma } from '@/lib/prisma';
import { EU_COUNTRIES } from '@/lib/shippingInternational';
import { locateOrder, statusGroup, type GeoPoint } from '@/lib/orderGeo';
import type { GeoResult } from '@/lib/geocode';

// Positions des commandes mémorisées dans site_settings (une ligne « ordergeo:<id commande> » par commande) : aucune
// migration de base. Une commande n'est géocodée qu'une seule fois ; un échec est mémorisé aussi (pas de boucle).

export const GEO_PREFIX = 'ordergeo:';

export type GeoOrderRow = {
  id: string;
  invoiceNumber: number;
  status: string;
  total: number;
  line1: string;
  zip: string;
  city: string;
  createdAt: Date;
};
export type GeoCacheValue = ({ fail?: undefined } & GeoResult) | { fail: true };

export async function loadGeoOrders(): Promise<GeoOrderRow[]> {
  const rows = await prisma.order.findMany({
    where: { replacementOfId: null, status: { in: ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'] } },
    select: { id: true, invoiceNumber: true, status: true, total: true, shippingLine1: true, shippingZip: true, shippingCity: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((o) => ({
    id: o.id,
    invoiceNumber: o.invoiceNumber,
    status: o.status,
    total: Number(o.total),
    line1: o.shippingLine1,
    zip: o.shippingZip,
    city: o.shippingCity,
    createdAt: o.createdAt,
  }));
}

export async function loadGeoCache(): Promise<Map<string, GeoCacheValue>> {
  const rows = await prisma.siteSetting.findMany({ where: { key: { startsWith: GEO_PREFIX } }, select: { key: true, value: true } });
  const map = new Map<string, GeoCacheValue>();
  for (const r of rows) {
    try {
      const v = JSON.parse(r.value) as GeoCacheValue;
      if (v && typeof v === 'object') map.set(r.key.slice(GEO_PREFIX.length), v);
    } catch {
      // ligne illisible : ignorée (la commande sera regéocodée)
    }
  }
  return map;
}

// Ville sans le pays ajouté à la fin (« Bruxelles (Belgique) » → « Bruxelles »).
const plainCity = (city: string) => city.replace(/\s*\([^()]+\)\s*$/, '').trim();

export function toPoint(o: GeoOrderRow, v: GeoCacheValue): GeoPoint | null {
  const g = statusGroup(o.status);
  if (!g || v.fail) return null;
  return { id: o.id, n: o.invoiceNumber, g, t: o.total, d: o.createdAt.toISOString(), c: plainCity(o.city), lat: v.lat, lon: v.lon, p: v.p };
}

// Pays de livraison d'une commande à géocoder à l'étranger (Monaco compris) ; null pour la France.
export function foreignInfo(o: GeoOrderRow): { name: string; code: string } | null {
  const place = locateOrder(o.zip, o.city);
  if (place.kind !== 'country') return null;
  const name = place.code === 'MC' ? 'Monaco' : EU_COUNTRIES.find((c) => c.code === place.code)?.name;
  return name ? { name, code: place.code } : null;
}

export { plainCity };
