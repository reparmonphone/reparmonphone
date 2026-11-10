import { prisma } from './prisma';
import { stripe } from './stripe';
import { deactivateSumupCheckout } from './sumup';

// Ferme les pages de paiement encore ouvertes (Stripe : jusqu'à 24 h ; SumUp) d'une commande EN ATTENTE.
// Sert quand un produit de la commande passe en rupture : le client ne doit plus pouvoir finir de payer.
// (PayPal ne permet pas de fermer une commande ouverte : le panier, lui, est refusé par lib/cartCheck.ts.)
export async function closeOrderPayment(o: { stripeSessionId?: string | null; sumupCheckoutId?: string | null }) {
  let closed = false;
  if (o.stripeSessionId) {
    try {
      await stripe.checkout.sessions.expire(o.stripeSessionId);
      closed = true;
    } catch {
      // déjà expirée / payée / introuvable
    }
  }
  if (o.sumupCheckoutId) {
    try {
      closed = (await deactivateSumupCheckout(o.sumupCheckoutId)) || closed;
    } catch {
      // sans conséquence
    }
  }
  return closed;
}

// Appelée quand un produit passe en rupture : ferme les paiements en attente qui le contiennent.
export async function closePendingPaymentsForProduct(productId: string): Promise<number> {
  const orders = (await prisma.order.findMany({
    where: { status: 'PENDING', items: { some: { productId } } },
    select: { stripeSessionId: true, sumupCheckoutId: true },
  })) as { stripeSessionId: string | null; sumupCheckoutId: string | null }[];
  let n = 0;
  for (const o of orders) if (await closeOrderPayment(o)) n++;
  return n;
}
