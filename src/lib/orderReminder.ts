import { prisma } from './prisma';
import { getResendClient } from './resend';
import { formatPrice } from './format';

export async function sendPendingOrderReminder(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: { include: { product: true } } } });
  if (!order) return { error: 'Commande introuvable.' };
  if (order.status !== 'PENDING') return { error: 'Cette commande n\u2019est plus en attente.' };

  const resend = getResendClient();
  if (!resend) {
    return { error: "Envoi d'email non configuré. Ajoute RESEND_API_KEY dans .env (voir README)." };
  }

  const itemsList = order.items.map((i) => `- ${i.quantity} × ${i.product.title}`).join('\n');

  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? 'ReparMonPhone <contact@reparmonphone.fr>',
      to: order.customerEmail,
      subject: 'Ta commande ReparMonPhone est toujours en attente de paiement',
      html: `
        <p>Bonjour ${order.customerName},</p>
        <p>Tu as commencé une commande sur ReparMonPhone, mais le paiement n'a pas encore été finalisé :</p>
        <p style="white-space: pre-line; background:#f9fafb; padding:12px; border-radius:8px;">${itemsList}</p>
        <p>Total : <strong>${formatPrice(Number(order.total))}</strong></p>
        <p>Si tu rencontres un souci pour payer, n'hésite pas à nous contacter directement au 07 83 49 72 62, ou à
        retourner sur <a href="https://www.reparmonphone.fr/boutique">notre boutique</a> pour repasser commande.</p>
        <p>L'équipe ReparMonPhone</p>
      `,
    });
  } catch (e) {
    console.error("Erreur envoi email de relance", e);
    return { error: "Erreur lors de l'envoi de l'email." };
  }

  await prisma.order.update({ where: { id: order.id }, data: { reminderSentAt: new Date() } });
  return { ok: true };
}
