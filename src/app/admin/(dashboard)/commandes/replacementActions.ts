'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdminUser } from '@/lib/supabase-server';
import { sendReplacementEmail, sendOrderShippedEmail } from '@/lib/orderEmails';
import type { ShippingCarrier } from '@prisma/client';

// ─────────────────────────────────────────────────────────────────────────────
// RENVOI : nouvelle expédition (gratuite) d'articles pour une commande déjà close — typiquement un
// produit potentiellement défectueux renvoyé en remplacement. On crée une VRAIE commande (mêmes
// statuts En préparation / Expédiée / Livrée, même suivi, mêmes e-mails, même demande d'avis) mais :
//   - à 0 € (aucun paiement, aucune facture),
//   - rattachée à la commande d'ORIGINE (replacementOfId) — jamais à un autre renvoi,
//   - exclue du chiffre d'affaires et des statistiques de ventes.
// La commande d'origine n'est PAS modifiée.
// ─────────────────────────────────────────────────────────────────────────────

const VALID_CARRIERS = ['CHRONOPOST', 'COLISSIMO', 'MONDIAL_RELAY', 'RELAIS_COLIS', 'AUTRE'];

export type ReplacementInput = {
  originalOrderId: string;
  items: { productId: string; quantity: number }[];
  reason: string; // motif interne (jamais montré au client)
  status: 'PROCESSING' | 'SHIPPED';
  carrier: string | null;
  trackingNumber: string;
  trackingUrlOverride: string;
  notifyCustomer: boolean;
};

export type ReplacementResult =
  | { ok: true; orderId: string; emailSent: boolean }
  | { error: string };

export async function createReplacementOrder(input: ReplacementInput): Promise<ReplacementResult> {
  await requireAdminUser();

  const original = await prisma.order.findUnique({ where: { id: input.originalOrderId } });
  if (!original) return { error: 'Commande introuvable.' };
  if (original.status === 'PENDING' || original.status === 'CANCELLED') {
    return { error: 'On ne renvoie pas une commande en attente de paiement ou annulée.' };
  }
  // Toujours rattaché à la commande d'ORIGINE (pas de chaîne de renvois)
  const rootId = original.replacementOfId ?? original.id;

  // Articles : on regroupe les doublons, on valide les quantités et on vérifie que chaque produit existe
  const merged = new Map<string, number>();
  for (const it of input.items ?? []) {
    const qty = Math.floor(Number(it.quantity));
    if (!it.productId || !Number.isFinite(qty) || qty < 1 || qty > 99) {
      return { error: 'Quantité invalide (entre 1 et 99).' };
    }
    merged.set(it.productId, (merged.get(it.productId) ?? 0) + qty);
  }
  if (merged.size === 0) return { error: 'Sélectionne au moins un article à renvoyer.' };
  if (merged.size > 30) return { error: 'Trop d’articles (30 maximum).' };

  const products = await prisma.product.findMany({
    where: { id: { in: [...merged.keys()] } },
    select: { id: true },
  });
  if (products.length !== merged.size) return { error: 'Un des produits sélectionnés n’existe plus.' };

  const carrier = input.carrier && VALID_CARRIERS.includes(input.carrier) ? (input.carrier as ShippingCarrier) : null;
  const trackingNumber = input.trackingNumber.trim().slice(0, 80) || null;
  const trackingUrlOverride = input.trackingUrlOverride.trim().slice(0, 500) || null;
  if (trackingUrlOverride && !/^https?:\/\//i.test(trackingUrlOverride)) {
    return { error: 'Le lien de suivi personnalisé doit commencer par https://' };
  }
  const status = input.status === 'SHIPPED' ? 'SHIPPED' : 'PROCESSING';
  const reason = input.reason.trim().slice(0, 1000);

  const created = await prisma.order.create({
    data: {
      replacementOfId: rootId,
      replacementReason: reason || null,
      userId: original.userId,
      customerName: original.customerName,
      customerEmail: original.customerEmail,
      customerPhone: original.customerPhone,
      companyName: original.companyName,
      shippingLine1: original.shippingLine1,
      shippingCity: original.shippingCity,
      shippingZip: original.shippingZip,
      billingName: original.billingName,
      billingLine1: original.billingLine1,
      billingCity: original.billingCity,
      billingZip: original.billingZip,
      status,
      subtotal: 0,
      discountAmount: 0,
      shippingCost: 0,
      shippingMethod: 'Renvoi gratuit',
      total: 0,
      paymentProvider: original.paymentProvider,
      carrier,
      trackingNumber,
      trackingUrlOverride,
      // Un client exclu des demandes d'avis le reste pour son renvoi
      noReviewRequest: original.noReviewRequest,
      items: {
        create: [...merged.entries()].map(([productId, quantity]) => ({ productId, quantity, unitPrice: 0 })),
      },
    },
    select: { id: true },
  });

  // E-mail client : « un nouvel envoi arrive » (en préparation) ou « votre colis est en route » (expédié)
  let emailSent = false;
  if (input.notifyCustomer) {
    try {
      if (status === 'SHIPPED') await sendOrderShippedEmail(created.id);
      else await sendReplacementEmail(created.id, 'announced');
      emailSent = true;
    } catch (e) {
      console.error('Erreur envoi e-mail renvoi', e);
    }
  }

  revalidatePath('/admin/commandes');
  revalidatePath(`/admin/commandes/${rootId}`);
  revalidatePath(`/admin/commandes/${original.id}`);
  revalidatePath('/compte/commandes');
  return { ok: true, orderId: created.id, emailSent };
}

// Recherche de produits pour ajouter un article « hors commande d'origine » (ex. une autre nappe)
export async function searchProductsForReplacement(query: string) {
  await requireAdminUser();
  const q = query.trim();
  if (q.length < 2) return [] as { id: string; title: string; inStock: boolean }[];
  const rows = await prisma.product.findMany({
    where: { title: { contains: q, mode: 'insensitive' } },
    select: { id: true, title: true, inStock: true },
    orderBy: { title: 'asc' },
    take: 8,
  });
  return rows;
}
