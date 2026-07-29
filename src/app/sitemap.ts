import { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';
import { PREFECTURES } from '@/data/prefectures';

// Slugs à ne jamais inclure dans le sitemap, même s'ils existaient un jour dans la table Page
// (sécurité supplémentaire en plus du blocage dans robots.txt et du noindex sur la page elle-même).
const EXCLUDED_PAGE_SLUGS = ['maintenance'];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.reparmonphone.fr';

  const [products, brands, collections, pages, repairGuides] = await Promise.all([
    prisma.product.findMany({ where: { showInBoutique: true }, select: { slug: true, updatedAt: true } }),
    prisma.brand.findMany({ select: { slug: true } }),
    prisma.collection.findMany({ select: { slug: true, updatedAt: true } }),
    prisma.page.findMany({ select: { slug: true, updatedAt: true } }),
    prisma.repairGuide.findMany({
      where: { published: true },
      select: { slug: true, updatedAt: true },
    }),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/boutique`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/reparation`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/livraison`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/rdv`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/contact`, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${base}/avis-verifies`, changeFrequency: 'monthly', priority: 0.4 },
  ];

  const productRoutes: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${base}/produit/${p.slug}`,
    lastModified: p.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  const brandRoutes: MetadataRoute.Sitemap = brands.map((b) => ({
    url: `${base}/marque/${b.slug}`,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  const collectionRoutes: MetadataRoute.Sitemap = collections.map((c) => ({
    url: `${base}/collection/${c.slug}`,
    lastModified: c.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.6,
  }));

  const pageRoutes: MetadataRoute.Sitemap = pages
    .filter((p) => !EXCLUDED_PAGE_SLUGS.includes(p.slug))
    .map((p) => ({
      url: `${base}/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: 'yearly',
      priority: 0.3,
    }));

  const repairGuideRoutes: MetadataRoute.Sitemap = repairGuides.map((g) => ({
    url: `${base}/reparation/guide/${g.slug}`,
    lastModified: g.updatedAt,
    changeFrequency: 'monthly',
    priority: 0.6,
  }));

  const villeRoutes: MetadataRoute.Sitemap = PREFECTURES.map((p) => ({
    url: `${base}/livraison/${p.slug}`,
    changeFrequency: 'monthly',
    priority: 0.5,
  }));

  return [
    ...staticRoutes,
    ...productRoutes,
    ...brandRoutes,
    ...collectionRoutes,
    ...pageRoutes,
    ...repairGuideRoutes,
    ...villeRoutes,
  ];
}
