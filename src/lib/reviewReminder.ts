import { prisma } from './prisma';
import { getResendClient } from './resend';

// Lien direct "écrire un avis" de ta page Trustpilot — gratuit, fonctionne avec le plan gratuit (aucune
// invitation automatique Trustpilot nécessaire : c'est NOTRE e-mail qui envoie le client vers ce lien).
// Règles Trustpilot respectées : la demande part à TOUS les clients livrés (pas de tri entre satisfaits et
// mécontents) et rien n'est offert en échange d'un avis.
const TRUSTPILOT_REVIEW_URL = 'https://fr.trustpilot.com/evaluate/reparmonphone.fr';

function trustpilotBlock(intro: string) {
  return `
        <div style="margin-top:20px;padding:16px;border:1px solid #e5e7eb;border-radius:8px;">
          <p style="margin:0 0 12px 0;">${intro}</p>
          <p style="margin:0;"><a href="${TRUSTPILOT_REVIEW_URL}" style="display:inline-block;background:#00b67a;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;">★ Donner mon avis sur Trustpilot</a></p>
        </div>`;
}

// Commandes à relancer : livrées depuis plus de 10 jours et jamais relancées. Pour les anciennes commandes
// passées en "Livrée" avant l'enregistrement de la date de livraison (deliveredAt vide), on se base sur la
// date de commande avec une marge de 14 jours.
export function reviewReminderEligibleWhere() {
  const DAY = 24 * 60 * 60 * 1000;
  return {
    status: 'DELIVERED' as const,
    reviewReminderSentAt: null,
    OR: [
      { deliveredAt: { lte: new Date(Date.now() - 10 * DAY) } },
      { deliveredAt: null, createdAt: { lte: new Date(Date.now() - 14 * DAY) } },
    ],
  };
}

export async function countReviewReminderEligible() {
  return prisma.order.count({ where: reviewReminderEligibleWhere() });
}

export async function sendReviewReminder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { product: true } } },
  });
  if (!order) return { error: 'Commande introuvable.' };
  if (order.status !== 'DELIVERED') return { error: 'Cette commande n\u2019est pas (ou plus) au statut "Livrée".' };

  // Ne relance que pour les produits pas encore commentés par ce client (si connecté)
  const reviewedProductIds = order.userId
    ? new Set(
        (
          await prisma.productReview.findMany({
            where: { userId: order.userId, productId: { in: order.items.map((i) => i.productId) } },
            select: { productId: true },
          })
        ).map((r) => r.productId)
      )
    : new Set<string>();

  const itemsToReview = order.items.filter((i) => !reviewedProductIds.has(i.productId));

  const resend = getResendClient();
  if (!resend) {
    return { error: "Envoi d'email non configuré. Ajoute RESEND_API_KEY dans .env (voir README)." };
  }

  const invoiceLabel = `${order.createdAt.getFullYear()}-${String(order.invoiceNumber).padStart(5, '0')}`;
  const itemsList = itemsToReview.map((i) => `- ${i.product.title}`).join('\n');
  const orderUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.reparmonphone.fr'}/compte/commandes/${order.id}`;

  const hasProductsToReview = itemsToReview.length > 0;

  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? 'ReparMonPhone <contact@reparmonphone.fr>',
      to: order.customerEmail,
      subject: hasProductsToReview
        ? `${order.customerName}, ton avis compte pour nous !`
        : `${order.customerName}, un petit avis sur Trustpilot ?`,
      html: hasProductsToReview
        ? `
        <p>Bonjour ${order.customerName},</p>
        <p>Ta commande n° ${invoiceLabel} t'a bien été livrée. On espère que tout fonctionne parfaitement !</p>
        <p>Aurais-tu 2 minutes pour laisser un avis sur ${itemsToReview.length > 1 ? 'les produits suivants' : 'le produit suivant'} :</p>
        <p style="white-space: pre-line; background:#f9fafb; padding:12px; border-radius:8px;">${itemsList}</p>
        <p><a href="${orderUrl}" style="display:inline-block;background:#0E7FDB;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Laisser un avis sur le produit</a></p>
        ${trustpilotBlock("Tu peux aussi partager ton expérience globale avec ReparMonPhone sur Trustpilot : ça nous aide beaucoup à nous faire connaître et rassure les futurs clients.")}
        <p>Merci beaucoup pour ta confiance !<br/>L'équipe ReparMonPhone</p>
      `
        : `
        <p>Bonjour ${order.customerName},</p>
        <p>Merci d'avoir déjà commenté tes produits sur notre site, c'est très précieux !</p>
        ${trustpilotBlock("Si tu as 2 minutes, ton avis sur Trustpilot nous aide beaucoup à nous faire connaître et rassure les futurs clients.")}
        <p>Merci beaucoup pour ta confiance !<br/>L'équipe ReparMonPhone</p>
      `,
    });
  } catch (e) {
    console.error('Erreur envoi email de relance avis', e);
    return { error: "Erreur lors de l'envoi de l'email." };
  }

  await prisma.order.update({ where: { id: order.id }, data: { reviewReminderSentAt: new Date() } });
  return { ok: true };
}
