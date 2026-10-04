import { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';
import { PREFECTURES } from '@/data/prefectures';
import {
  getLandingCombos,
  getModelLandingCombos,
  landingPieceByType,
  MIN_INDEXABLE_PRODUCTS,
  MIN_MODEL_PIECE_PRODUCTS,
} from '@/lib/landingPages';

// Sans ça, ce fichier n'est généré QU'UNE SEULE FOIS, au moment du build — un produit ajouté, une
// gamme réorganisée ou un modèle renommé depuis l'admin (donc SANS nouveau déploiement du code) ne
// serait alors répercuté dans /sitemap.xml qu'au prochain déploiement, parfois des semaines plus
// tard. Avec `revalidate`, Next.js régénère ce fichier au maximum une fois par heure, dès qu'une
// requête arrive après ce délai (ex: le prochain passage du robot Google) — le catalogue affiché
// dans le sitemap reste donc à jour en continu, sans solliciter la base à chaque visite.
export const revalidate = 3600;

// Slugs à ne jamais inclure dans le sitemap, même s'ils existaient un jour dans la table Page
// (sécurité supplémentaire en plus du blocage dans robots.txt et du noindex sur la page elle-même).
const EXCLUDED_PAGE_SLUGS = ['maintenance'];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.reparmonphone.fr';

  const [landingCombos, modelCombos, products, brands, lines, collections, pages, repairGuides] = await Promise.all([
    getLandingCombos(),
    getModelLandingCombos(),
    prisma.product.findMany({ where: { showInBoutique: true }, select: { slug: true, updatedAt: true, imageUrl: true } }),
    prisma.brand.findMany({ select: { slug: true } }),
    // Pages de gamme (ex: /marque/samsung/galaxy-a, /marque/apple/iphone) : ce sont des pages d'atterrissage
    // clés pour des recherches nationales du type "écran iPhone" / "batterie Galaxy A" — jusqu'ici absentes du
    // sitemap alors que seules les pages marque et produit y figuraient. On n'inclut que les gammes qui ont au
    // moins un produit en boutique (pas de page vide à faire indexer).
    prisma.productLine.findMany({
      where: { models: { some: { products: { some: { showInBoutique: true } } } } },
      select: { slug: true, brand: { select: { slug: true } } },
    }),
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
    { url: `${base}/reparation-a-distance`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/contact`, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${base}/avis-verifies`, changeFrequency: 'monthly', priority: 0.4 },
  ];

  const productRoutes: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${base}/produit/${p.slug}`,
    lastModified: p.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.8,
    // Sitemap images : aide Google Images à indexer les photos produit (trafic national supplémentaire).
    // Seules les URLs absolues sont acceptées par le format sitemap.
    ...(p.imageUrl && /^https?:\/\//.test(p.imageUrl) ? { images: [p.imageUrl] } : {}),
  }));

  const brandRoutes: MetadataRoute.Sitemap = brands.map((b) => ({
    url: `${base}/marque/${b.slug}`,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  const lineRoutes: MetadataRoute.Sitemap = lines.map((l) => ({
    url: `${base}/marque/${l.brand.slug}/${l.slug}`,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  // Pages d'atterrissage "pièce + marque" et "pièce + gamme" (/pieces-detachees/...), uniquement celles qui
  // ont assez de produits pour être indexables (voir MIN_INDEXABLE_PRODUCTS dans src/lib/landingPages.ts).
  const brandTotals = new Map<string, number>();
  for (const c of landingCombos) {
    const k = `${c.brandSlug}/${c.type}`;
    brandTotals.set(k, (brandTotals.get(k) ?? 0) + c.count);
  }
  const landingRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/pieces-detachees`, changeFrequency: 'weekly', priority: 0.8 },
    ...Array.from(brandTotals.entries()).flatMap(([k, total]) => {
      if (total < MIN_INDEXABLE_PRODUCTS) return [];
      const [brandSlug, type] = k.split('/');
      const piece = landingPieceByType(type as Parameters<typeof landingPieceByType>[0]);
      return piece
        ? [{ url: `${base}/pieces-detachees/${brandSlug}/${piece.slug}`, changeFrequency: 'weekly' as const, priority: 0.8 }]
        : [];
    }),
    ...landingCombos
      .filter((c) => c.count >= MIN_INDEXABLE_PRODUCTS)
      .flatMap((c) => {
        const piece = landingPieceByType(c.type);
        return piece
          ? [{ url: `${base}/pieces-detachees/${c.brandSlug}/${c.lineSlug}/${piece.slug}`, changeFrequency: 'weekly' as const, priority: 0.7 }]
          : [];
      }),
  ];

  // Pages "modèle" (toutes les pièces d'un modèle) et "modèle + pièce" (ex: écran iPhone 12 Pro Max) : ce sont elles
  // qui répondent aux recherches précises qui génèrent le plus d'impressions. Mêmes seuils d'indexation que la page.
  const modelTotals = new Map<string, number>();
  for (const c of modelCombos) {
    const k = `${c.brandSlug}/${c.lineSlug}/${c.modelSlug}`;
    modelTotals.set(k, (modelTotals.get(k) ?? 0) + c.count);
  }
  const modelRoutes: MetadataRoute.Sitemap = [
    ...Array.from(modelTotals.entries())
      .filter(([, total]) => total >= MIN_INDEXABLE_PRODUCTS)
      .map(([k]) => ({ url: `${base}/pieces-detachees/${k}`, changeFrequency: 'weekly' as const, priority: 0.7 })),
    ...modelCombos
      .filter((c) => c.count >= MIN_MODEL_PIECE_PRODUCTS)
      .flatMap((c) => {
        const piece = landingPieceByType(c.type);
        return piece
          ? [{ url: `${base}/pieces-detachees/${c.brandSlug}/${c.lineSlug}/${c.modelSlug}/${piece.slug}`, changeFrequency: 'weekly' as const, priority: 0.7 }]
          : [];
      }),
  ];

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
    ...lineRoutes,
    ...landingRoutes,
    ...modelRoutes,
    ...collectionRoutes,
    ...pageRoutes,
    ...repairGuideRoutes,
    ...villeRoutes,
  ];
}
