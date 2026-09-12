// Lit le réglage "livraison gratuite à partir de X€" — stocké dans SiteSetting (même pattern que les
// interrupteurs de moyens de paiement, voir src/app/panier/page.tsx). Écriture faite depuis
// /admin/livraison, voir setFreeShippingSettings dans ./livraison/actions.ts.
//
// Par défaut (tant que Krys n'a rien réglé), la livraison gratuite est ACTIVE à 250€ — c'est la valeur
// déjà annoncée sur le site (bannière d'accueil, CGV) : elle doit rester vraie sans réglage explicite.
import { prisma } from '@/lib/prisma';
import type { FreeShippingConfig } from '@/lib/shippingZones';

export const FREE_SHIPPING_DEFAULT_THRESHOLD = 250;

export async function getFreeShippingConfig(): Promise<FreeShippingConfig> {
  const settings = await prisma.siteSetting.findMany({
    where: { key: { in: ['free_shipping_enabled', 'free_shipping_threshold'] } },
  });
  const enabledSetting = settings.find((s) => s.key === 'free_shipping_enabled');
  const thresholdSetting = settings.find((s) => s.key === 'free_shipping_threshold');

  const enabled = enabledSetting ? enabledSetting.value === 'true' : true;
  const parsedThreshold = thresholdSetting ? Number(thresholdSetting.value) : NaN;
  const threshold = Number.isFinite(parsedThreshold) && parsedThreshold >= 0 ? parsedThreshold : FREE_SHIPPING_DEFAULT_THRESHOLD;

  return { enabled, threshold };
}
