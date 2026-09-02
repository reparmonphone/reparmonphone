import Link from 'next/link';
import Image from 'next/image';
import { prisma } from '@/lib/prisma';
import { LINE_CONTENT_KEY } from '@/lib/categoryContent';

const BRAND_ORDER = ['apple', 'samsung', 'huawei', 'xiaomi'];

const ASSETS: Record<string, { logo: string; phones: string }> = {
  apple: { logo: '/categories/logo-apple.png', phones: '/categories/phones-apple.png' },
  samsung: { logo: '/categories/logo-samsung.png', phones: '/categories/phones-samsung.png' },
  huawei: { logo: '/categories/logo-huawei.png', phones: '/categories/phones-huawei.png' },
  xiaomi: { logo: '/categories/logo-xiaomi.png', phones: '/categories/phones-xiaomi.png' },
};

// Gammes choisies à la main pour cette section (dans cet ordre précis) plutôt que les 6 premières
// gammes par ordre alphabétique (comportement par défaut ci-dessous, encore utilisé pour Apple/
// Huawei/Xiaomi tant qu'aucune sélection n'a été demandée pour elles) — sans ça "Galaxy S", par
// exemple, n'apparaîtrait jamais ici (alphabétiquement trop loin pour entrer dans les 6 premières).
const FEATURED_LINE_SLUGS: Record<string, string[]> = {
  samsung: ['galaxy-a', 'galaxy-s', 'galaxy-j', 'galaxy-m', 'galaxy-z', 'galaxy-note'],
};

export default async function CategoriesEnVedette() {
  const brandsRaw = await prisma.brand.findMany({
    // On n'affiche que les 4 marques téléphone reconnues (par slug, stable même si le nom est renommé) —
    // la marque "Outils" (ou toute autre marque annexe) n'apparaît jamais ici.
    where: { slug: { in: BRAND_ORDER } },
    include: {
      // Pas de `take` ici : pour une marque avec une sélection FEATURED_LINE_SLUGS, il faut pouvoir
      // retrouver n'importe laquelle de ses gammes (pas seulement les 6 premières alphabétiquement) —
      // le "top 6" par défaut est appliqué plus bas, en JS, seulement pour les marques sans sélection.
      lines: {
        orderBy: { name: 'asc' },
      },
    },
  });

  const brands = [...brandsRaw]
    .sort((a, b) => BRAND_ORDER.indexOf(a.slug) - BRAND_ORDER.indexOf(b.slug))
    .map((brand) => {
      const featuredSlugs = FEATURED_LINE_SLUGS[brand.slug];
      if (!featuredSlugs) return { ...brand, lines: brand.lines.slice(0, 6) };
      const bySlug = new Map(brand.lines.map((l) => [l.slug, l]));
      const lines = featuredSlugs.map((slug) => bySlug.get(slug)).filter((l): l is (typeof brand.lines)[number] => !!l);
      return { ...brand, lines };
    });

  if (brands.length === 0) return null;

  return (
    <section className="w-full bg-white py-12">
      <div className="mx-auto w-full max-w-7xl px-4">
        <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900">Catégories En Vedette</h2>
        <p className="text-gray-500 mt-1 mb-8">Retrouvez les catégories les plus consultées sur ReparMonPhone</p>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {brands.map((brand) => {
            const assets = ASSETS[brand.slug];
            return (
              <div
                key={brand.id}
                className="flex min-h-[610px] flex-col items-center border border-gray-200 bg-white px-5 py-6 text-center"
              >
                {/* Logo de la marque */}
                <Link href={`/marque/${brand.slug}`} className="flex h-[110px] w-full items-center justify-center">
                  {assets?.logo ? (
                    <Image
                      src={assets.logo}
                      alt={`Logo ${brand.name}`}
                      width={210}
                      height={95}
                      unoptimized
                      className="max-h-[95px] max-w-[210px] w-auto h-auto object-contain"
                    />
                  ) : (
                    <span className="font-extrabold text-xl text-gray-900">{brand.name}</span>
                  )}
                </Link>

                {/* Liste des gammes — vrais liens vers la boutique filtrée */}
                <div className="mt-6 flex flex-col items-center gap-4">
                  {brand.lines.map((line) => {
                    const contentKey = LINE_CONTENT_KEY[`${brand.slug}/${line.slug}`];
                    const lineHref = contentKey
                      ? `/marque/${brand.slug}/${contentKey}`
                      : `/boutique?marque=${brand.slug}&gamme=${line.slug}`;
                    return (
                      <Link
                        key={line.id}
                        href={lineHref}
                        className="text-[17px] font-medium text-cyan-500 transition-colors hover:text-cyan-700"
                      >
                        {line.name}
                      </Link>
                    );
                  })}
                </div>

                {/* Image des téléphones en bas */}
                {assets?.phones && (
                  <Link
                    href={`/marque/${brand.slug}`}
                    className="mt-auto flex h-[250px] w-full items-end justify-center pt-8"
                  >
                    <Image
                      src={assets.phones}
                      alt={`Pièces détachées ${brand.name}`}
                      width={280}
                      height={240}
                      unoptimized
                      className="max-h-[240px] max-w-full w-auto h-auto object-contain"
                    />
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
