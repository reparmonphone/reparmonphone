import { prisma } from '@/lib/prisma';
import ShippingOptionsList from './ShippingOptionsList';

export default async function AdminLivraisonPage() {
  const options = await prisma.shippingOption.findMany({ orderBy: { order: 'asc' } });

  return (
    <div className="max-w-2xl">
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
  );
}
