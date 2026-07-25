import Link from 'next/link';
import Image from 'next/image';
import { prisma } from '@/lib/prisma';

const LINES = [
  { name: 'Apple AirPods', lineSlug: 'airpods' },
  { name: 'Apple Watch', lineSlug: 'apple-watch' },
  { name: 'Apple iPad', lineSlug: 'ipad' },
];

export default async function AppleAccessoriesRow() {
  const items = await Promise.all(
    LINES.map(async (line) => {
      const product = await prisma.product.findFirst({
        where: { model: { productLine: { slug: line.lineSlug, brand: { slug: 'apple' } } }, imageUrl: { not: null } },
        orderBy: { createdAt: 'desc' },
      });
      return { ...line, imageUrl: product?.imageUrl ?? null };
    })
  );

  if (items.every((i) => !i.imageUrl)) return null;

  return (
    <section className="max-w-6xl mx-auto px-4 py-10">
      <div className="grid md:grid-cols-3 gap-4">
        {items.map((item) => (
          <Link
            key={item.name}
            href={`/boutique?marque=apple&gamme=${item.lineSlug}`}
            className="relative h-80 rounded-xl overflow-hidden bg-white group hover:shadow-lg transition-shadow"
          >
            {item.imageUrl && (
              <Image
                src={item.imageUrl}
                alt={item.name}
                fill
                className="object-contain p-2 group-hover:scale-105 transition"
                sizes="(max-width: 768px) 100vw, 33vw"
              />
            )}
            <div className="absolute bottom-0 left-0 right-0 p-5">
              <p className="text-gray-700">{item.name}</p>
              <p className="text-brand-dark font-bold text-lg">Pièces &amp; Accessoires</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
