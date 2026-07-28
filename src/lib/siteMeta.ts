import { prisma } from '@/lib/prisma';

// Valeurs par défaut, utilisées tant que rien n'a été personnalisé depuis /admin/seo.
export const DEFAULT_SITE_TITLE = 'ReparMonPhone | Pièces Détachées Téléphone - Sainte-Maxime';
export const DEFAULT_SITE_DESCRIPTION =
  'Réparation et pièces détachées à Sainte-Maxime et dans le Golfe de Saint-Tropez. Écrans, batteries, connecteurs. Livraison Chronopost 24h.';

export async function getSiteMeta() {
  try {
    const settings = await prisma.siteSetting.findMany({
      where: { key: { in: ['seo_site_title', 'seo_site_description'] } },
    });
    const title = settings.find((s) => s.key === 'seo_site_title')?.value || DEFAULT_SITE_TITLE;
    const description =
      settings.find((s) => s.key === 'seo_site_description')?.value || DEFAULT_SITE_DESCRIPTION;
    return { title, description };
  } catch {
    // base pas encore initialisée — pas bloquant, on retombe sur les valeurs par défaut
    return { title: DEFAULT_SITE_TITLE, description: DEFAULT_SITE_DESCRIPTION };
  }
}
