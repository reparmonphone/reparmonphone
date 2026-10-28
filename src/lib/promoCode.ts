import { prisma } from './prisma';
import { hasUsedPromo, loadTicketOnly, parsePersonalCode, verifyPersonalCode } from './marketing';

// Commandes réellement payées (une commande PENDING/annulée ne « consomme » ni n'ouvre aucun droit).
const PAID_STATUSES = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'] as const;

export type PromoContext = {
  email?: string | null; // e-mail saisi dans le panier (ou celui du compte connecté)
  userId?: string | null; // compte connecté, si présent
  accountEmail?: string | null; // e-mail du compte connecté (≠ e-mail saisi dans le panier) : sert aux codes personnels des tickets
  phone?: string | null; // téléphone du compte connecté
  ip?: string | null; // adresse IP du visiteur
  items?: { productId: string; quantity: number }[]; // contenu du panier (pour les codes non cumulables)
};

export async function validatePromoCode(codeInput: string, subtotal: number, ctx: PromoContext = {}) {
  let code = codeInput.trim().toUpperCase();
  if (!code) return { error: 'Code invalide.' };

  let promo = await prisma.promoCode.findUnique({ where: { code } });
  // Code personnel d'un ticket à gratter : « BASE-XXXXXX » (voir lib/marketing.ts)
  let personalSuffix: string | null = null;
  if (!promo) {
    const pc = parsePersonalCode(code);
    if (pc) {
      const base = await prisma.promoCode.findUnique({ where: { code: pc.base } });
      if (base && (await loadTicketOnly()).has(base.code)) {
        promo = base;
        personalSuffix = pc.suffix;
        code = base.code;
      }
    }
  }
  if (!promo) return { error: 'Ce code promo n’existe pas.' };
  // Un code « ticket » ne s'utilise jamais seul : seulement sous sa forme personnelle (liée au compte)
  if (!personalSuffix && (await loadTicketOnly()).has(promo.code)) {
    return { error: 'Ce code est personnel : utilise le code de ton ticket à gratter, reçu par e-mail.' };
  }
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

  // Code personnel de ticket : lié au COMPTE qui a reçu le ticket, et utilisable une seule fois.
  if (personalSuffix) {
    const account = ctx.accountEmail?.trim().toLowerCase() || null;
    if (!ctx.userId || !account) {
      return { error: 'Ce code est personnel : connecte-toi d’abord à ton compte ReparMonPhone pour l’utiliser.' };
    }
    if (!verifyPersonalCode(personalSuffix, account)) {
      return { error: 'Ce code ne correspond pas à ton compte : il n’est valable que pour la personne qui a reçu le ticket.' };
    }
    const used = await hasUsedPromo(promo.code, { userId: ctx.userId, emails: [account, ctx.email], phone: ctx.phone, ip: ctx.ip });
    if (used) return { error: 'Ton code a déjà été utilisé : il n’est valable qu’une seule fois par client.' };
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
