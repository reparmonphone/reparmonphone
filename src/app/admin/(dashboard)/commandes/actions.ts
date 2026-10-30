'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { requireAdminUser } from '@/lib/supabase-server';
import { sendPendingOrderReminder } from '@/lib/orderReminder';
import { sendReviewReminder, reviewReminderEligibleWhere, reviewReminderAllDeliveredWhere } from '@/lib/reviewReminder';
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

// Relance groupée "laisse un avis" (produits + Trustpilot), par petits lots de 5 pour rester sous la limite
// de durée des fonctions Vercel et respecter le débit d'envoi de Resend : le bouton côté admin rappelle
// cette action en boucle jusqu'à ce qu'il n'en reste plus.
//  - mode "new" : commandes livrées depuis plus de 10 jours et jamais relancées (voir reviewReminderEligibleWhere)
//  - mode "all" : toutes les commandes "Livrée", même déjà relancées (voir reviewReminderAllDeliveredWhere)
// startedAt = début de la session de relance ; skipIds = commandes déjà en échec pendant cette session.
// Un client qui a plusieurs commandes livrées ne reçoit qu'UN seul e-mail par session.
export async function sendReviewReminderBatch(
  mode: 'new' | 'all',
  startedAtIso: string,
  skipIds: string[] = []
) {
  await requireAdminUser();
  const startedAt = new Date(startedAtIso);
  // Calculé une seule fois par appel (inclut la liste des clients exclus des demandes d'avis)
  const base = mode === 'all' ? await reviewReminderAllDeliveredWhere(startedAt) : await reviewReminderEligibleWhere();
  const baseWhere = () => base;

  const batch = await prisma.order.findMany({
    where: { ...baseWhere(), id: { notIn: skipIds } },
    select: { id: true, customerEmail: true },
    orderBy: { createdAt: 'asc' },
    take: 5,
  });

  let sent = 0;
  let duplicates = 0;
  const failedIds: string[] = [];
  let lastError: string | undefined;
  for (const order of batch) {
    // Déjà relancé pendant cette session via une autre de ses commandes ? On marque celle-ci comme traitée
    // sans renvoyer d'e-mail.
    const alreadyEmailed = await prisma.order.findFirst({
      where: { customerEmail: order.customerEmail, reviewReminderSentAt: { gte: startedAt } },
      select: { id: true },
    });
    if (alreadyEmailed) {
      await prisma.order.update({ where: { id: order.id }, data: { reviewReminderSentAt: new Date() } });
      duplicates++;
      continue;
    }

    const result = await sendReviewReminder(order.id);
    if (result.error) {
      failedIds.push(order.id);
      lastError = result.error;
    } else {
      sent++;
    }
    await new Promise((resolve) => setTimeout(resolve, 600));
  }

  const remaining = await prisma.order.count({
    where: { ...baseWhere(), id: { notIn: [...skipIds, ...failedIds] } },
  });

  revalidatePath('/admin/commandes');
  return { sent, duplicates, failedIds, lastError, remaining };
}

// Case « Ne pas demander d'avis » : exclut la commande (et les autres commandes du même client) des relances
// automatiques (cron), de la relance groupée et du bouton manuel.
export async function setNoReviewRequest(orderId: string, value: boolean) {
  await requireAdminUser();
  await prisma.order.update({ where: { id: orderId }, data: { noReviewRequest: value } });
  revalidatePath('/admin/commandes');
  revalidatePath(`/admin/commandes/${orderId}`);
  return { ok: true };
}

export async function deleteOrder(orderId: string) {
  await requireAdminUser();
  // Une commande qui a des renvois ne peut pas être supprimée (les renvois perdraient leur commande d'origine)
  const renvois = await prisma.order.count({ where: { replacementOfId: orderId } });
  if (renvois > 0) {
    return { error: `Cette commande a ${renvois} renvoi(s) : supprime d’abord le(s) renvoi(s).` };
  }
  // Commande en attente de paiement : on ferme la page de paiement Stripe encore ouverte, sinon le client pourrait
  // encore payer (jusqu'à 24 h) une commande qui n'existe plus.
  const toDelete = await prisma.order.findUnique({ where: { id: orderId }, select: { status: true, stripeSessionId: true } });
  if (toDelete?.status === 'PENDING' && toDelete.stripeSessionId) {
    try {
      await stripe.checkout.sessions.expire(toDelete.stripeSessionId);
    } catch {
      // déjà expirée, déjà payée ou introuvable : sans conséquence
    }
  }
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
