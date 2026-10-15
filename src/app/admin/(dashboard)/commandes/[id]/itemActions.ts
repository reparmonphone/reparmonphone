'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdminUser } from '@/lib/supabase-server';
import { addOrderNote } from './noteActions';

const round2 = (n: number) => Math.round(n * 100) / 100;

// Statuts où la commande est déjà partie (ou terminée) : on ne retire plus d'article.
const LOCKED_STATUSES = ['SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'];

export type RemoveItemResult =
  | {
      ok: true;
      refundAmount: number; // ce que le client doit récupérer (à rembourser à la main chez PayPal/SumUp/Stripe)
      newTotal: number;
      hasPromo: boolean;
      noteSent: boolean;
      noteError?: string;
    }
  | { error: string };

// Retire un article (ou une partie de la quantité) d'une commande à la demande du client, par exemple
// après une rupture de stock. Recalcule le sous-total et le total. NE REMBOURSE PAS automatiquement :
// le remboursement se fait à la main chez le prestataire de paiement, le montant à rembourser est renvoyé.
// Si notifyMessage est renseigné, une note visible par le client est ajoutée ET envoyée par email
// (même mécanisme que « Note pour le client »).
export async function removeOrderItem(
  orderId: string,
  orderItemId: string,
  quantity: number,
  notifyMessage?: string
): Promise<RemoveItemResult> {
  await requireAdminUser();

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { shipmentItems: true } } },
  });
  if (!order) return { error: 'Commande introuvable.' };
  if (LOCKED_STATUSES.includes(order.status)) {
    return { error: "Cette commande est déjà expédiée, livrée, annulée ou remboursée : impossible de retirer un article." };
  }

  const item = order.items.find((i) => i.id === orderItemId);
  if (!item) return { error: "Cet article n'appartient pas à cette commande." };

  const qty = Math.floor(Number(quantity));
  if (!Number.isFinite(qty) || qty < 1 || qty > item.quantity) {
    return { error: `Quantité invalide (entre 1 et ${item.quantity}).` };
  }

  const remainingQty = item.quantity - qty;
  const alreadyShipped = item.shipmentItems.reduce((sum, si) => sum + si.quantity, 0);
  if (remainingQty < alreadyShipped) {
    return { error: 'Cet article a déjà été (en partie) expédié dans un colis : impossible de le retirer.' };
  }

  const remainingLines = order.items.length - (remainingQty === 0 ? 1 : 0);
  if (remainingLines === 0) {
    return {
      error:
        "C'est le dernier article de la commande. Pour tout annuler, passe plutôt la commande au statut « Annulée » et rembourse le client.",
    };
  }

  const newSubtotal = round2(
    order.items.reduce((sum, i) => {
      const q = i.id === item.id ? remainingQty : i.quantity;
      return sum + Number(i.unitPrice) * q;
    }, 0)
  );
  const oldDiscount = Number(order.discountAmount);
  const newDiscount = Math.min(oldDiscount, newSubtotal);
  const newTotal = round2(newSubtotal - newDiscount + Number(order.shippingCost));
  const refundAmount = round2(Number(order.total) - newTotal);

  await prisma.$transaction([
    remainingQty === 0
      ? prisma.orderItem.delete({ where: { id: item.id } })
      : prisma.orderItem.update({ where: { id: item.id }, data: { quantity: remainingQty } }),
    prisma.order.update({
      where: { id: orderId },
      data: { subtotal: newSubtotal, discountAmount: newDiscount, total: newTotal },
    }),
  ]);

  let noteSent = false;
  let noteError: string | undefined;
  const msg = (notifyMessage ?? '').trim();
  if (msg) {
    try {
      const r = await addOrderNote(orderId, msg);
      if ('error' in r) noteError = r.error;
      else noteSent = true;
    } catch (e) {
      noteError = e instanceof Error ? e.message : "L'email n'a pas pu être envoyé.";
    }
  }

  revalidatePath('/admin/commandes');
  revalidatePath(`/admin/commandes/${orderId}`);
  revalidatePath('/admin/benefice');
  revalidatePath('/compte/commandes');
  revalidatePath(`/compte/commandes/${orderId}`);

  return { ok: true, refundAmount, newTotal, hasPromo: !!order.promoCode, noteSent, noteError };
}
