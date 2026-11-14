'use server';

import { prisma } from '@/lib/prisma';
import { requireAdminUser } from '@/lib/supabase-server';
import { formatPrice } from '@/lib/format';
import { SETTING_KEY, normalizeConfig } from '@/lib/promoPopup';

// Enregistre le pop-up d'ouverture. Rien n'est visible des visiteurs tant que « enabled » est faux.
// Les visiteurs voient le changement en ~1 minute (cache de /api/popup), sans redéploiement.
export async function savePromoPopup(raw: unknown) {
  await requireAdminUser();
  const config = normalizeConfig(raw);
  if (config.enabled && (!config.title || !config.ctaHref)) {
    return { error: 'Pour activer le pop-up, il faut au minimum un titre et un lien du bouton.' };
  }
  if (config.scheduleEnabled && config.start && config.end && config.end < config.start) {
    return { error: 'La date de fin doit être après la date de début.' };
  }
  const value = JSON.stringify(config);
  await prisma.siteSetting.upsert({
    where: { key: SETTING_KEY },
    update: { value },
    create: { key: SETTING_KEY, value },
  });
  return { ok: true as const, config };
}

// « Remplir depuis un produit » : on colle l'adresse ou le nom court (slug) de la fiche, le titre, le prix,
// l'image et le lien sont repris automatiquement (tout reste modifiable ensuite).
export async function fetchProductForPopup(input: string) {
  await requireAdminUser();
  const slug = input
    .trim()
    .replace(/^https?:\/\/[^/]+/i, '')
    .replace(/^\/?produit\//i, '')
    .replace(/[/?#].*$/, '');
  if (!slug) return { error: 'Colle l’adresse de la fiche produit (ou son nom court).' };
  const p = await prisma.product.findUnique({
    where: { slug },
    select: { slug: true, title: true, price: true, regularPrice: true, imageUrl: true, images: true },
  });
  if (!p) return { error: 'Aucun produit trouvé avec cette adresse.' };
  const price = Number(p.price);
  const regular = p.regularPrice ? Number(p.regularPrice) : 0;
  return {
    ok: true as const,
    product: {
      title: p.title,
      price: formatPrice(price),
      oldPrice: regular > price ? formatPrice(regular) : '',
      imageUrl: p.imageUrl || p.images?.[0] || '',
      href: `/produit/${p.slug}`,
    },
  };
}
