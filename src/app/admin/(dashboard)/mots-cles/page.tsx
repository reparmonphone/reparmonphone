import { prisma } from '@/lib/prisma';
import MotsClesTool from './MotsClesTool';

export const metadata = { title: 'Mots-clés & SEO | Administration' };

export default async function MotsClesPage() {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.reparmonphone.fr';

  const [brands, saved] = await Promise.all([
    prisma.brand.findMany({
      orderBy: { name: 'asc' },
      select: { name: true, slug: true, lines: { select: { models: { orderBy: { sortOrder: 'asc' }, select: { name: true } } } } },
    }),
    prisma.siteSetting.findUnique({ where: { key: 'seo_saved_keywords' } }),
  ]);

  const models = brands.flatMap((b) =>
    b.lines.flatMap((l) => l.models.map((m) => ({ brand: b.name, name: m.name })))
  );

  const priorityUrls = [
    `${site}/`,
    `${site}/boutique`,
    `${site}/reparation`,
    `${site}/reparation-a-distance`,
    `${site}/rdv`,
    ...brands.map((b) => `${site}/marque/${b.slug}`),
  ];

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">🧠 Mots-clés & SEO</h1>
        <p className="text-sm text-gray-500 mt-1">
          Génère des mots-clés, titres, méta-descriptions et brouillons d&apos;articles, puis prépare l&apos;envoi à Google Search Console.
          Tout est calculé ici même (aucun abonnement, aucune clé API) : ce sont des suggestions à relire avant de publier.
        </p>
      </div>
      <MotsClesTool
        site={site}
        models={models}
        priorityUrls={priorityUrls}
        savedKeywords={saved?.value ? saved.value.split('\n').filter(Boolean) : []}
      />
    </div>
  );
}
