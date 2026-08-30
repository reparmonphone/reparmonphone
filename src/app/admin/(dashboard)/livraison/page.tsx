import { prisma } from '@/lib/prisma';
import ShippingOptionsList from './ShippingOptionsList';
import ShippingZonesManager from './ShippingZonesManager';

export default async function AdminLivraisonPage() {
  const [options, zones, rates] = await Promise.all([
    prisma.shippingOption.findMany({ orderBy: { order: 'asc' } }),
    prisma.shippingZone.findMany({ orderBy: { order: 'asc' } }),
    prisma.shippingZoneRate.findMany(),
  ]);

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-1">Frais de port</h1>
        <p className="text-gray-500 mb-6">
          Options de livraison proposées au client sur la page panier — le total se met à jour automatiquement
          selon son choix. Désactive une option pour la masquer temporairement sans la supprimer.
        </p>

        <ShippingOptionsList
          options={options.map((o) => ({
            id: o.id,
            label: o.label,
            description: o.description ?? '',
            price: Number(o.price),
            active: o.active,
          }))}
        />
      </div>

      <ShippingZonesManager
        options={options.map((o) => ({ id: o.id, label: o.label, price: Number(o.price) }))}
        zones={zones.map((z) => ({ id: z.id, name: z.name, postalPrefixes: z.postalPrefixes }))}
        rates={rates.map((r) => ({ shippingOptionId: r.shippingOptionId, zoneId: r.zoneId, price: Number(r.price) }))}
      />
    </div>
  );
}
