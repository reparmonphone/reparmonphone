import Link from 'next/link';
import Image from 'next/image';
import { prisma } from '@/lib/prisma';

export const metadata = {
  title: 'Guides de réparation — Apple, Samsung, Huawei, Xiaomi | ReparMonPhone',
  description:
    'Tous nos guides de réparation étape par étape : remplacement d\u2019écran, batterie, connecteur de charge... Tutoriels gratuits pour réparer votre téléphone vous-même.',
};

const DIFFICULTY_LABEL: Record<string, { label: string; className: string }> = {
  FACILE: { label: 'Facile', className: 'bg-green-100 text-green-700' },
  MOYEN: { label: 'Moyen', className: 'bg-amber-100 text-amber-700' },
  DIFFICILE: { label: 'Difficile', className: 'bg-red-100 text-red-700' },
};

export default async function ReparationPage({
  searchParams,
}: {
  searchParams: { marque?: string; difficulte?: string; q?: string };
}) {
  const where: Record<string, unknown> = { published: true };

  if (searchParams.q) {
    where.title = { contains: searchParams.q, mode: 'insensitive' };
  }
  if (searchParams.difficulte) {
    where.difficulty = searchParams.difficulte;
  }
  if (searchParams.marque) {
    where.model = { productLine: { brand: { slug: searchParams.marque } } };
  }

  const [guides, brands] = await Promise.all([
    prisma.repairGuide.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { model: { include: { productLine: { include: { brand: true } } } } },
    }),
    prisma.brand.findMany({ orderBy: { name: 'asc' } }),
  ]);

  return (
    <div>
      <div className="bg-gray-50 border-b border-gray-100 py-10 text-center">
        <h1 className="text-3xl font-bold text-gray-900">Guides de réparation</h1>
        <p className="text-gray-500 mt-2 max-w-xl mx-auto">
          Des tutoriels étape par étape pour réparer votre téléphone vous-même — écran, batterie,
          connecteur de charge, et plus encore.
        </p>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-10">
        <form className="flex flex-wrap gap-3 mb-8" action="/reparation" method="get">
          <input
            type="text"
            name="q"
            defaultValue={searchParams.q}
            placeholder="Rechercher un guide..."
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1 min-w-[200px]"
          />
          <select name="marque" defaultValue={searchParams.marque ?? ''} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
            <option value="">Toutes les marques</option>
            {brands.map((b) => (
              <option key={b.id} value={b.slug}>{b.name}</option>
            ))}
          </select>
          <select name="difficulte" defaultValue={searchParams.difficulte ?? ''} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
            <option value="">Toutes difficultés</option>
            <option value="FACILE">Facile</option>
            <option value="MOYEN">Moyen</option>
            <option value="DIFFICILE">Difficile</option>
          </select>
          <button type="submit" className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-dark transition">
            Filtrer
          </button>
        </form>

        {guides.length === 0 ? (
          <p className="text-gray-500">Aucun guide ne correspond à ces filtres pour le moment.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {guides.map((guide) => {
              const diff = DIFFICULTY_LABEL[guide.difficulty];
              return (
                <Link
                  key={guide.id}
                  href={`/reparation/guide/${guide.slug}`}
                  className="group bg-white border border-gray-100 rounded-xl overflow-hidden hover:shadow-md transition"
                >
                  <div className="relative aspect-video bg-gray-50">
                    {guide.coverImageUrl ? (
                      <Image
                        src={guide.coverImageUrl}
                        alt={guide.title}
                        fill
                        className="object-cover group-hover:scale-105 transition"
                        sizes="(max-width: 768px) 100vw, 33vw"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300 text-3xl">🔧</div>
                    )}
                  </div>
                  <div className="p-4">
                    {guide.model && (
                      <span className="text-xs text-gray-400">
                        {guide.model.productLine.brand.name} · {guide.model.name}
                      </span>
                    )}
                    <h3 className="font-semibold text-gray-800 mt-1 group-hover:text-brand transition line-clamp-2">
                      {guide.title}
                    </h3>
                    {guide.excerpt && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{guide.excerpt}</p>}
                    <div className="flex items-center gap-2 mt-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${diff.className}`}>{diff.label}</span>
                      {guide.estimatedTime && <span className="text-xs text-gray-400">⏱ {guide.estimatedTime}</span>}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
