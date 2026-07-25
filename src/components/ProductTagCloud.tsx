import Link from 'next/link';
import { prisma } from '@/lib/prisma';

export default async function ProductTagCloud() {
  const models = await prisma.model.findMany({
    orderBy: { name: 'asc' },
    take: 40,
    include: { productLine: { include: { brand: true } } },
  });

  if (models.length === 0) return null;

  return (
    <section className="max-w-6xl mx-auto px-4 py-10">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Étiquettes Produit</h2>
      <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-4">
        {models.map((m) => (
          <Link
            key={m.id}
            href={`/boutique?marque=${m.productLine.brand.slug}&gamme=${m.productLine.slug}&modele=${m.slug}`}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:border-brand hover:text-brand transition"
          >
            {m.name}
          </Link>
        ))}
      </div>
    </section>
  );
}
