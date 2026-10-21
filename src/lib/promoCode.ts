import { prisma } from './prisma';

// Commandes réellement payées (une commande PENDING/annulée ne « consomme » ni n'ouvre aucun droit).
const PAID_STATUSES = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'] as const;

export type PromoContext = {
  email?: string | null; // e-mail saisi dans le panier (ou celui du compte connecté)
  userId?: string | null; // compte connecté, si présent
  ip?: string | null; // adresse IP du visiteur
  items?: { productId: string; quantity: number }[]; // contenu du panier (pour les codes non cumulables)
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

  // Montant minimum de panier (produits seuls, hors livraison et hors remise). Le sous-total est relu côté
  // serveur par les routes de paiement ; seul l'aperçu du panier (/api/promo/validate) utilise la valeur envoyée.
  const minOrder = promo.minOrderAmount !== null ? Number(promo.minOrderAmount) : null;
  if (minOrder !== null && Math.round(subtotal * 100) < Math.round(minOrder * 100)) {
    const fmt = minOrder.toLocaleString('fr-FR', { minimumFractionDigits: minOrder % 1 ? 2 : 0, maximumFractionDigits: 2 });
    const missing = (minOrder - subtotal).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return { error: `Ce code est valable à partir de ${fmt} € d’achats (hors livraison) : il te manque ${missing} € dans ton panier.` };
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

  // Code non cumulable : la remise ne porte que sur les produits SANS promotion en cours (prix barré).
  // Les prix sont relus en base — on ne se fie jamais au panier du navigateur.
  let base = subtotal;
  let excluded = 0;
  if (promo.nonCumulable) {
    const items = (ctx.items ?? []).filter((i) => i && i.productId && Number(i.quantity) > 0);
    if (items.length === 0) return { error: 'Panier introuvable : recharge la page puis réessaie.' };
    const products = await prisma.product.findMany({
      where: { id: { in: items.map((i) => i.productId) } },
      select: { id: true, price: true, regularPrice: true },
    });
    base = 0;
    for (const it of items) {
      const p = products.find((x) => x.id === it.productId);
      if (!p) continue;
      const line = Number(p.price) * Number(it.quantity);
      const onSale = p.regularPrice != null && Number(p.regularPrice) > Number(p.price);
      if (onSale) excluded += line;
      else base += line;
    }
    base = Math.round(base * 100) / 100;
    if (base <= 0) {
      return { error: 'Ce code n’est pas cumulable avec les produits déjà en promotion : aucun produit de ton panier n’est éligible.' };
    }
  }

  const value = Number(promo.value);
  const discount = promo.type === 'PERCENT' ? Math.round(base * (value / 100) * 100) / 100 : Math.min(value, base);
  const note = promo.nonCumulable && excluded > 0 ? 'Remise appliquée uniquement sur les produits hors promotion (non cumulable).' : undefined;

  return { ok: true as const, code: promo.code, discount, note, nonCumulable: promo.nonCumulable, minOrderAmount: minOrder };
}
