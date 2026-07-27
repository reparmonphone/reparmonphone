import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.reparmonphone.fr';
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/api', '/compte', '/checkout/success', '/panier'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
