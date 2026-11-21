import { aggregateByPeriod } from '@/lib/orderGeo';
import { loadGeoCache, loadGeoOrders, toPoint } from '@/lib/orderGeoServer';
import CarteTabs from './CarteTabs';

export const dynamic = 'force-dynamic';
export const maxDuration = 30; // la localisation des adresses se fait par petits paquets, chacun reste court

export default async function AdminCarteCommandesPage() {
  const [orders, cache] = await Promise.all([loadGeoOrders(), loadGeoCache()]);

  // Vue par zones : répartition par pays / département (code postal)
  const aggs = aggregateByPeriod(
    orders.map((o) => ({ status: o.status, total: o.total, zip: o.zip, city: o.city, createdAt: o.createdAt })),
  );

  // Carte précise : commandes déjà localisées ; les autres seront localisées par le navigateur, par petits paquets
  const points = orders.flatMap((o) => {
    const v = cache.get(o.id);
    const p = v ? toPoint(o, v) : null;
    return p ? [p] : [];
  });
  const todo = orders.filter((o) => !cache.has(o.id)).length;
  const failed = orders.filter((o) => cache.get(o.id)?.fail).length;

  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-bold mb-1">🗺️ Carte des commandes</h1>
      <p className="text-gray-500 mb-6">
        Où sont livrées tes commandes, à partir de l’adresse de livraison. Choisis ce que tu veux voir avec les boutons : commandes
        valides, remboursées, annulées, ou tout à la fois.
      </p>
      <CarteTabs aggs={aggs} points={points} todo={todo} failed={failed} />
    </div>
  );
}
