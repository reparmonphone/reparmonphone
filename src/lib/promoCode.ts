import { prisma } from './prisma';

export async function validatePromoCode(codeInput: string, subtotal: number) {
  const code = codeInput.trim().toUpperCase();
  if (!code) return { error: 'Code invalide.' };

  const promo = await prisma.promoCode.findUnique({ where: { code } });
  if (!promo) return { error: 'Ce code promo n\u2019existe pas.' };
  if (!promo.active) return { error: 'Ce code promo n\u2019est plus actif.' };
  if (promo.expiresAt && promo.expiresAt < new Date()) return { error: 'Ce code promo a expiré.' };
  if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
    return { error: 'Ce code promo a atteint sa limite d\u2019utilisation.' };
  }

  const value = Number(promo.value);
  const discount = promo.type === 'PERCENT' ? Math.round(subtotal * (value / 100) * 100) / 100 : Math.min(value, subtotal);

  return { ok: true as const, code: promo.code, discount };
}
