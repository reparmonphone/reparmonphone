import { prisma } from '@/lib/prisma';

// Valeurs par défaut, utilisées tant que rien n'a été personnalisé depuis /admin/seo.
export const DEFAULT_SITE_TITLE = 'ReparMonPhone | Pièces Détachées Téléphone - Sainte-Maxime';
export const DEFAULT_SITE_DESCRIPTION =
  'Réparation et pièces détachées à Sainte-Maxime et dans le Golfe de Saint-Tropez. Écrans, batteries, connecteurs. Livraison Chronopost 24h.';
// Vide par défaut : tant qu'aucune image n'est renseignée dans /admin/seo, le site n'envoie pas
// d'image Open Graph (mieux vaut aucune image qu'une image cassée sur un lien qui n'existe pas encore).
export const DEFAULT_OG_IMAGE_URL = '';

export async function getSiteMeta() {
  try {
    const settings = await prisma.siteSetting.findMany({
      where: { key: { in: ['seo_site_title', 'seo_site_description', 'seo_og_image_url'] } },
    });
    const title = settings.find((s) => s.key === 'seo_site_title')?.value || DEFAULT_SITE_TITLE;
    const description =
      settings.find((s) => s.key === 'seo_site_description')?.value || DEFAULT_SITE_DESCRIPTION;
    const ogImageUrl = settings.find((s) => s.key === 'seo_og_image_url')?.value || DEFAULT_OG_IMAGE_URL;
    return { title, description, ogImageUrl };
  } catch {
    // base pas encore initialisée — pas bloquant, on retombe sur les valeurs par défaut
    return { title: DEFAULT_SITE_TITLE, description: DEFAULT_SITE_DESCRIPTION, ogImageUrl: DEFAULT_OG_IMAGE_URL };
  }
}
