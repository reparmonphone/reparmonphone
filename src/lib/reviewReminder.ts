import { prisma } from './prisma';
import { getResendClient } from './resend';

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
  if (itemsToReview.length === 0) {
    // Tout a déjà été commenté — pas besoin de relancer, mais on marque quand même comme "traité"
    await prisma.order.update({ where: { id: order.id }, data: { reviewReminderSentAt: new Date() } });
    return { ok: true, skipped: true };
  }

  const resend = getResendClient();
  if (!resend) {
    return { error: "Envoi d'email non configuré. Ajoute RESEND_API_KEY dans .env (voir README)." };
  }

  const invoiceLabel = `${order.createdAt.getFullYear()}-${String(order.invoiceNumber).padStart(5, '0')}`;
  const itemsList = itemsToReview.map((i) => `- ${i.product.title}`).join('\n');
  const orderUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.reparmonphone.fr'}/compte/commandes/${order.id}`;

  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? 'ReparMonPhone <contact@reparmonphone.fr>',
      to: order.customerEmail,
      subject: `${order.customerName}, ton avis compte pour nous !`,
      html: `
        <p>Bonjour ${order.customerName},</p>
        <p>Ta commande n° ${invoiceLabel} t'a bien été livrée. On espère que tout fonctionne parfaitement !</p>
        <p>Aurais-tu 2 minutes pour laisser un avis sur ${itemsToReview.length > 1 ? 'les produits suivants' : 'le produit suivant'} :</p>
        <p style="white-space: pre-line; background:#f9fafb; padding:12px; border-radius:8px;">${itemsList}</p>
        <p><a href="${orderUrl}" style="display:inline-block;background:#0E7FDB;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Laisser un avis</a></p>
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
