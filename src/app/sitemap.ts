import { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.reparmonphone.fr';

  const [products, brands, collections, pages] = await Promise.all([
    prisma.product.findMany({ where: { showInBoutique: true }, select: { slug: true, updatedAt: true } }),
    prisma.brand.findMany({ select: { slug: true } }),
    prisma.collection.findMany({ select: { slug: true, updatedAt: true } }),
    prisma.page.findMany({ select: { slug: true, updatedAt: true } }),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/boutique`, changeFrequency: 'daily', priority: 0.9 },
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

  const pageRoutes: MetadataRoute.Sitemap = pages.map((p) => ({
    url: `${base}/${p.slug}`,
    lastModified: p.updatedAt,
    changeFrequency: 'yearly',
    priority: 0.3,
  }));

  return [...staticRoutes, ...productRoutes, ...brandRoutes, ...collectionRoutes, ...pageRoutes];
}
