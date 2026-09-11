'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdminUser } from '@/lib/supabase-server';
import { sendPendingOrderReminder } from '@/lib/orderReminder';
import { sendReviewReminder } from '@/lib/reviewReminder';
import { sendOrderShippedEmail, sendTrackingNumberEmail } from '@/lib/orderEmails';
import type { OrderStatus, ShippingCarrier } from '@prisma/client';

export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  await requireAdminUser();
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  const wasAlreadyShipped = order?.status === 'SHIPPED' || order?.status === 'DELIVERED';

  await prisma.order.update({
    where: { id: orderId },
    data: {
      status,
      // On mémorise la date de livraison seulement la première fois (pas si le statut est modifié plusieurs fois)
      deliveredAt: status === 'DELIVERED' && !order?.deliveredAt ? new Date() : undefined,
    },
  });

  // Email "commande expédiée" uniquement lors du passage EN statut SHIPPED (pas si on re-sélectionne
  // SHIPPED alors que c'était déjà le cas, ni si on modifie un autre champ plus tard).
  if (status === 'SHIPPED' && !wasAlreadyShipped) {
    await sendOrderShippedEmail(orderId);
  }

  revalidatePath('/admin/commandes');
  revalidatePath(`/admin/commandes/${orderId}`);
}

export async function updateOrderTracking(
  orderId: string,
  data: { carrier: ShippingCarrier | null; trackingNumber: string; trackingUrlOverride: string }
) {
  await requireAdminUser();

  const existing = await prisma.order.findUnique({ where: { id: orderId } });
  const newTrackingNumber = data.trackingNumber || null;
  // On n'envoie l'email que si un numéro de suivi non vide vient d'être ajouté ou modifié
  // (évite de spammer le client si l'admin ré-enregistre le même formulaire sans rien changer).
  const shouldNotify = !!newTrackingNumber && newTrackingNumber !== existing?.trackingNumber;

  await prisma.order.update({
    where: { id: orderId },
    data: {
      carrier: data.carrier,
      trackingNumber: newTrackingNumber,
      trackingUrlOverride: data.trackingUrlOverride || null,
    },
  });

  if (shouldNotify) {
    await sendTrackingNumberEmail(orderId);
  }

  revalidatePath('/admin/commandes');
  revalidatePath(`/admin/commandes/${orderId}`);
  revalidatePath('/compte/commandes');
}

export async function sendReminderManually(orderId: string) {
  await requireAdminUser();
  const result = await sendPendingOrderReminder(orderId);
  revalidatePath('/admin/commandes');
  return result;
}

export async function sendReviewReminderManually(orderId: string) {
  await requireAdminUser();
  const result = await sendReviewReminder(orderId);
  revalidatePath('/admin/commandes');
  revalidatePath(`/admin/commandes/${orderId}`);
  return result;
}

export async function deleteOrder(orderId: string) {
  await requireAdminUser();
  await prisma.orderItem.deleteMany({ where: { orderId } });
  await prisma.order.delete({ where: { id: orderId } });
  revalidatePath('/admin/commandes');
  return { ok: true };
}

// Coûts réels de la commande (prix d'achat fournisseur par article + frais de port réellement payés)
// — champs admin uniquement, jamais exposés au client, saisis à la main car le prix d'achat pro varie
// d'une commande à l'autre. Utilisés uniquement par la page /admin/benefice pour calculer le bénéfice.
export async function updateOrderCosts(
  orderId: string,
  data: { items: { id: string; costPrice: number | null }[]; actualShippingCost: number | null }
) {
  await requireAdminUser();

  // Sécurité : Prisma n'accepte que l'id comme clé unique dans update(), donc on vérifie ici que
  // chaque article appartient bien à CETTE commande avant de le modifier (empêche un id d'article
  // forgé, d'une autre commande, d'être modifié par erreur).
  const ownedIds = new Set(
    (await prisma.orderItem.findMany({ where: { orderId }, select: { id: true } })).map((i) => i.id)
  );
  const validItems = data.items.filter((item) => ownedIds.has(item.id));

  await prisma.$transaction([
    ...validItems.map((item) =>
      prisma.orderItem.update({ where: { id: item.id }, data: { costPrice: item.costPrice } })
    ),
    prisma.order.update({
      where: { id: orderId },
      data: { actualShippingCost: data.actualShippingCost },
    }),
  ]);

  revalidatePath(`/admin/commandes/${orderId}`);
  revalidatePath('/admin/benefice');
  return { ok: true };
}
