'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getResendClient } from '@/lib/resend';

const FROM = process.env.RESEND_FROM_EMAIL ?? 'ReparMonPhone <contact@reparmonphone.fr>';
const ADMIN_EMAIL = 'contact@reparmonphone.fr';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.reparmonphone.fr';

export async function submitClaim(orderId: string, description: string, photoUrl: string) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'Vous devez être connecté.' };
  if (!description.trim()) return { error: 'Merci de décrire le problème.' };

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { error: 'Commande introuvable.' };
  // Vérifie que la commande appartient bien à l'utilisateur connecté (même logique que la liste)
  if (order.userId !== user.id && order.customerEmail !== user.email) {
    return { error: 'Cette commande ne vous appartient pas.' };
  }

  const claim = await prisma.claim.create({
    data: {
      orderId,
      customerEmail: order.customerEmail,
      description: description.trim(),
      photoUrl: photoUrl || null,
    },
  });

  const resend = getResendClient();
  if (resend) {
    try {
      await resend.emails.send({
        from: FROM,
        to: ADMIN_EMAIL,
        replyTo: order.customerEmail,
        subject: `⚠️ Nouveau litige — Commande #${order.invoiceNumber || order.id.slice(-8)}`,
        html: `
          <div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px; margin: 0 auto;">
            <div style="background:#dc2626; padding: 24px; border-radius: 8px 8px 0 0; text-align: center;">
              <h1 style="color:#ffffff; font-size: 20px; margin: 0;">Nouvelle réclamation client</h1>
            </div>
            <div style="background:#ffffff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; padding: 24px;">
              <p style="color:#374151; font-size: 14px;"><strong>Client :</strong> ${order.customerName} (${order.customerEmail})</p>
              <p style="color:#374151; font-size: 14px;"><strong>Commande :</strong> #${order.invoiceNumber || order.id.slice(-8)} — ${Number(order.total).toFixed(2)}€</p>
              <div style="border-top: 1px solid #e5e7eb; padding-top: 12px; margin-top: 12px;">
                <p style="color:#6b7280; font-size: 12px; text-transform: uppercase; margin: 0 0 8px;">Description</p>
                <p style="color:#374151; font-size: 14px; line-height: 1.6; white-space: pre-line;">${description}</p>
              </div>
              ${photoUrl ? `<p style="margin-top:16px;"><a href="${photoUrl}" style="color:#dc2626; font-weight:600;">📷 Voir la photo jointe</a></p>` : ''}
              <div style="text-align:center; margin-top: 20px;">
                <a href="${SITE_URL}/admin/litiges/${claim.id}" style="display:inline-block; background:#dc2626; color:#fff; text-decoration:none; padding: 10px 24px; border-radius: 8px; font-size: 14px; font-weight: 600;">Traiter ce litige</a>
              </div>
            </div>
          </div>
        `,
      });
    } catch (e) {
      console.error("Erreur envoi notification litige", e);
    }
  }

  revalidatePath('/compte/commandes');
  return { ok: true };
}
