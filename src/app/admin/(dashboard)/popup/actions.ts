'use server';

import { prisma } from '@/lib/prisma';
import { requireAdminUser } from '@/lib/supabase-server';
import { formatPrice } from '@/lib/format';
import { revalidatePath } from 'next/cache';
import { SETTING_KEY, normalizeConfig, parisLocalToMs, statsIdFor } from '@/lib/promoPopup';
import { statsPrefix } from '@/lib/promoStats';

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
  if (config.countdownEnabled) {
    const end = parisLocalToMs(config.countdownEnd);
    if (end === null) return { error: 'Pour le compte à rebours, choisis la date et l’heure de fin de l’offre.' };
    if (config.enabled && end <= Date.now()) {
      return { error: 'La fin du compte à rebours est déjà passée : choisis une date et une heure à venir.' };
    }
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

// Remet à zéro les compteurs (affichages et clics) de l'offre dont le lien est indiqué.
export async function resetPromoStats(ctaHref: string) {
  await requireAdminUser();
  if (typeof ctaHref !== 'string' || !ctaHref) return { error: 'Aucune offre à remettre à zéro.' };
  await prisma.siteSetting.deleteMany({ where: { key: { startsWith: statsPrefix(statsIdFor(ctaHref)) } } });
  revalidatePath('/admin/popup');
  return { ok: true as const };
}
