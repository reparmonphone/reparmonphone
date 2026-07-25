import { prisma } from '@/lib/prisma';
import RdvForm from './RdvForm';

export default async function RdvPage() {
  const zones = await prisma.serviceZone.findMany({ orderBy: { extraFee: 'asc' } });

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-2">Prendre rendez-vous</h1>
      <p className="text-gray-600 mb-8">Réparation en atelier ou à domicile, sur Sainte-Maxime et le Golfe de Saint-Tropez.</p>

      <RdvForm zones={zones.map((z) => ({ cityName: z.cityName, extraFee: Number(z.extraFee) }))} />
    </div>
  );
}
