import { prisma } from './prisma';

// Commandes réellement payées (une commande PENDING/annulée ne « consomme » ni n'ouvre aucun droit).
const PAID_STATUSES = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'] as const;

export type PromoContext = {
  email?: string | null; // e-mail saisi dans le panier (ou celui du compte connecté)
  userId?: string | null; // compte connecté, si présent
  ip?: string | null; // adresse IP du visiteur
};

export async function validatePromoCode(codeInput: string, subtotal: number, ctx: PromoContext = {}) {
  const code = codeInput.trim().toUpperCase();
  if (!code) return { error: 'Code invalide.' };

  const promo = await prisma.promoCode.findUnique({ where: { code } });
  if (!promo) return { error: 'Ce code promo n’existe pas.' };
  if (!promo.active) return { error: 'Ce code promo n’est plus actif.' };
  if (promo.expiresAt && promo.expiresAt < new Date()) return { error: 'Ce code promo a expiré.' };
  if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
    return { error: 'Ce code promo a atteint sa limite d’utilisation.' };
  }

  // Codes réservés aux clients fidèles (ex. REPARMONPHONEFIDELITY) : 2ème commande, 1 usage par client / IP.
  if (promo.requiresPriorOrder || promo.oncePerCustomer) {
    const email = ctx.email?.trim().toLowerCase() || null;
    const userId = ctx.userId || null;
    const ip = ctx.ip || null;

    if (!email && !userId) {
      return { error: 'Renseigne d’abord ton adresse e-mail dans le formulaire du panier, puis applique le code.' };
    }
    const identity = [
      ...(email ? [{ customerEmail: { equals: email, mode: 'insensitive' as const } }] : []),
      ...(userId ? [{ userId }] : []),
    ];

    if (promo.requiresPriorOrder) {
      const previous = await prisma.order.count({ where: { status: { in: [...PAID_STATUSES] }, OR: identity } });
      if (previous === 0) {
        return { error: 'Ce code est réservé à la 2ème commande : il faut avoir déjà passé une commande avec cette adresse e-mail.' };
      }
    }
    if (promo.oncePerCustomer) {
      const alreadyUsed = await prisma.order.count({
        where: {
          promoCode: promo.code,
          status: { in: [...PAID_STATUSES, 'REFUNDED'] },
          OR: [...identity, ...(ip ? [{ ipAddress: ip }] : [])],
        },
      });
      if (alreadyUsed > 0) {
        return { error: 'Ce code a déjà été utilisé : il n’est valable qu’une seule fois par client.' };
      }
    }
  }

  const value = Number(promo.value);
  const discount = promo.type === 'PERCENT' ? Math.round(subtotal * (value / 100) * 100) / 100 : Math.min(value, subtotal);

  return { ok: true as const, code: promo.code, discount };
}
