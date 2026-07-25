import { prisma } from '@/lib/prisma';
import ZoneRow from './ZoneRow';
import NewZoneForm from './NewZoneForm';

export default async function AdminZonesPage() {
  const zones = await prisma.serviceZone.findMany({ orderBy: { extraFee: 'asc' } });

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-2">Zones & tarifs de déplacement</h1>
      <p className="text-gray-500 mb-6">
        Utilisées pour les RDV à domicile. La ville sans frais est la zone "de base" (généralement Sainte-Maxime).
      </p>

      <div className="bg-white border border-gray-100 rounded-xl divide-y divide-gray-100 mb-6">
        {zones.map((z) => (
          <ZoneRow key={z.id} zone={{ id: z.id, cityName: z.cityName, extraFee: Number(z.extraFee) }} />
        ))}
      </div>

      <div className="bg-white border border-gray-100 rounded-xl p-5">
        <h2 className="font-semibold mb-3">Ajouter une ville</h2>
        <NewZoneForm />
      </div>
    </div>
  );
}
