import { prisma } from '@/lib/prisma';
import { INTERNATIONAL_SETTING_KEY, DEFAULT_INTERNATIONAL, normalizeInternational, type InternationalConfig } from '@/lib/shippingInternational';

// Lit les réglages de livraison à l'étranger (voir /admin/livraison). Valeurs par défaut tant que rien n'est enregistré.
export async function getInternationalConfig(): Promise<InternationalConfig> {
  try {
    const row = await prisma.siteSetting.findUnique({ where: { key: INTERNATIONAL_SETTING_KEY } });
    if (row?.value) return normalizeInternational(JSON.parse(row.value));
  } catch {
    // réglage illisible : valeurs par défaut
  }
  return DEFAULT_INTERNATIONAL;
}
