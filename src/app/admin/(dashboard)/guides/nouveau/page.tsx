import { prisma } from '@/lib/prisma';
import GuideForm from '../GuideForm';

export default async function NouveauGuidePage() {
  const brands = await prisma.brand.findMany({
    orderBy: { name: 'asc' },
    include: {
      lines: {
        orderBy: { name: 'asc' },
        include: { models: { orderBy: { name: 'asc' } } },
      },
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Nouveau guide de réparation</h1>
      <GuideForm brands={brands} />
    </div>
  );
}
