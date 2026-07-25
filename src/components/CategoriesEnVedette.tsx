import Link from 'next/link';
import Image from 'next/image';
import { prisma } from '@/lib/prisma';

const BRAND_ORDER = ['Apple', 'Samsung', 'Huawei', 'Xiaomi'];

const ASSETS: Record<string, { logo: string; phones: string }> = {
  apple: { logo: '/categories/logo-apple.png', phones: '/categories/phones-apple.png' },
  samsung: { logo: '/categories/logo-samsung.png', phones: '/categories/phones-samsung.png' },
  huawei: { logo: '/categories/logo-huawei.png', phones: '/categories/phones-huawei.png' },
  xiaomi: { logo: '/categories/logo-xiaomi.png', phones: '/categories/phones-xiaomi.png' },
};

export default async function CategoriesEnVedette() {
  const brandsRaw = await prisma.brand.findMany({
    where: { name: { notIn: ['Autre', 'Autres'] } },
    include: {
      lines: {
        orderBy: { name: 'asc' },
        take: 6,
      },
    },
  });

  const brands = [...brandsRaw].sort((a, b) => {
    const ia = BRAND_ORDER.indexOf(a.name);
    const ib = BRAND_ORDER.indexOf(b.name);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });

  if (brands.length === 0) return null;

  return (
    <section className="max-w-6xl mx-auto px-4 py-12">
      <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900">Catégories En Vedette</h2>
      <p className="text-gray-500 mt-1 mb-8">Retrouvez les catégories les plus consultées sur ReparMonPhone</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {brands.map((brand) => {
          const assets = ASSETS[brand.slug];
          return (
            <div key={brand.id} className="border border-gray-200 rounded-xl p-5 flex flex-col items-center text-center bg-white">
              <Link href={`/boutique?marque=${brand.slug}`} className="mb-4 block">
                {assets?.logo ? (
                  <div className="relative w-full h-16">
                    <Image src={assets.logo} alt={brand.name} fill unoptimized className="object-contain" sizes="150px" />
                  </div>
                ) : (
                  <span className="font-extrabold text-xl text-gray-900 hover:text-brand">{brand.name}</span>
                )}
              </Link>

              <ul className="space-y-1.5 mb-4">
                {brand.lines.map((line) => (
                  <li key={line.id}>
                    <Link
                      href={`/boutique?marque=${brand.slug}&gamme=${line.slug}`}
                      className="text-sm text-brand hover:underline hover:text-brand-dark"
                    >
                      {line.name}
                    </Link>
                  </li>
                ))}
              </ul>

              {assets?.phones && (
                <div className="relative w-full h-32 mt-auto">
                  <Image src={assets.phones} alt={`Pièces ${brand.name}`} fill unoptimized className="object-contain" sizes="200px" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
