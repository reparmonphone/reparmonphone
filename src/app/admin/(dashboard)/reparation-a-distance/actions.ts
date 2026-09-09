'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdminUser } from '@/lib/supabase-server';
import { getResendClient } from '@/lib/resend';
import { stripe } from '@/lib/stripe';
import type { MailInRepairStatus, ShippingCarrier } from '@prisma/client';

const FROM = process.env.RESEND_FROM_EMAIL ?? 'ReparMonPhone <contact@reparmonphone.fr>';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.reparmonphone.fr';

export async function updateMailInRepairStatus(repairId: string, status: MailInRepairStatus) {
  await requireAdminUser();
  await prisma.mailInRepair.update({ where: { id: repairId }, data: { status } });
  revalidatePath('/admin/reparation-a-distance');
  revalidatePath(`/admin/reparation-a-distance/${repairId}`);
}

// Réponse libre envoyée au client — c'est ICI que l'adresse d'envoi doit être communiquée une fois
// la demande validée (jamais avant, voir la page publique /reparation-a-distance).
export async function sendMailInRepairReply(repairId: string, replyMessage: string) {
  await requireAdminUser();

  if (!replyMessage.trim()) {
    return { error: 'Le message de réponse est vide.' };
  }

  const repair = await prisma.mailInRepair.findUnique({ where: { id: repairId } });
  if (!repair) return { error: 'Demande introuvable.' };

  await prisma.mailInRepair.update({
    where: { id: repairId },
    data: {
      adminReply: replyMessage,
      repliedAt: new Date(),
      // Si la demande était encore au statut initial, une réponse envoyée signifie qu'on attend
      // maintenant que le client nous envoie l'appareil (à l'adresse tout juste communiquée).
      ...(repair.status === 'REQUESTED' ? { status: 'AWAITING_DEVICE' as const } : {}),
    },
  });

  const resend = getResendClient();
  if (resend) {
    try {
      await resend.emails.send({
        from: FROM,
        to: repair.customerEmail,
        replyTo: 'contact@reparmonphone.fr',
        subject: `Réponse à votre demande de réparation par correspondance — ReparMonPhone`,
        html: `
          <div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px; margin: 0 auto;">
            <div style="background:#1e3a8a; padding: 24px; border-radius: 8px 8px 0 0; text-align: center;">
              <h1 style="color:#ffffff; font-size: 20px; margin: 0;">Réponse à votre demande</h1>
            </div>
            <div style="background:#ffffff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; padding: 24px;">
              <p style="color:#374151; font-size: 14px; line-height: 1.6;">
                Bonjour ${repair.customerName},
              </p>
              <p style="color:#374151; font-size: 14px; line-height: 1.6; white-space: pre-line; background:#f9fafb; border-radius:8px; padding:16px; margin: 16px 0;">
                ${replyMessage}
              </p>
              <p style="color:#6b7280; font-size: 13px; margin-top: 20px;">
                Rappel de votre demande initiale : <strong>${repair.deviceBrand} ${repair.deviceModel}</strong>.
              </p>
              <div style="background:#eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 14px 16px; margin: 20px 0;">
                <p style="color:#1e3a8a; font-size: 14px; line-height: 1.6; margin:0 0 10px; font-weight:600;">
                  📦 Une fois votre appareil envoyé
                </p>
                <p style="color:#1e40af; font-size: 13px; line-height: 1.6; margin:0 0 12px;">
                  Renseignez-nous votre numéro de suivi (Chronopost ou Colissimo recommandé) via ce lien,
                  pour qu'on sache que votre colis est en route :
                </p>
                <div style="text-align:center;">
                  <a href="${SITE_URL}/reparation-a-distance/suivi/${repair.id}" style="display:inline-block; background:#1e3a8a; color:#fff; text-decoration:none; padding: 10px 24px; border-radius: 8px; font-size: 14px; font-weight: 600;">Indiquer mon numéro de suivi</a>
                </div>
              </div>
              <p style="color:#374151; font-size: 14px; margin-top: 20px;">
                Vous pouvez répondre directement à cet email si vous avez une question.
              </p>
            </div>
            <p style="color:#9ca3af; font-size: 12px; text-align: center; margin-top: 16px;">
              ReparMonPhone — Les Saquèdes, 83120 Sainte-Maxime — <a href="tel:+33783497262" style="color:#9ca3af;">07 83 49 72 62</a>
            </p>
          </div>
        `,
      });
    } catch (e) {
      console.error("Erreur lors de l'envoi de la réponse au client (réparation par correspondance)", e);
      return { error: "Réponse enregistrée, mais l'email n'a pas pu être envoyé. Vérifie la config Resend." };
    }
  }

  revalidatePath(`/admin/reparation-a-distance/${repairId}`);
  revalidatePath('/admin/reparation-a-distance');

  return { ok: true };
}

// Crée un lien de paiement Stripe pour le montant final (pièce + main d'œuvre + renvoi Chronopost
// TOUJOURS inclus dans ce prix unique, jamais facturé à part) et l'envoie par email au client.
// L'appareil n'est renvoyé qu'une fois ce paiement confirmé (voir le webhook Stripe).
export async function sendMailInRepairPaymentLink(repairId: string, priceEuros: number) {
  await requireAdminUser();

  if (!priceEuros || priceEuros <= 0) {
    return { error: 'Le montant doit être supérieur à 0.' };
  }

  const repair = await prisma.mailInRepair.findUnique({ where: { id: repairId } });
  if (!repair) return { error: 'Demande introuvable.' };

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'eur',
          product_data: {
            name: `Réparation par correspondance — ${repair.deviceBrand} ${repair.deviceModel}`,
            description: 'Pièce, main d’œuvre et renvoi Chronopost 24h inclus',
          },
          unit_amount: Math.round(priceEuros * 100),
        },
        quantity: 1,
      },
    ],
    customer_email: repair.customerEmail,
    metadata: { mailInRepairId: repair.id },
    success_url: `${SITE_URL}/reparation-a-distance/paiement-confirme?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${SITE_URL}/reparation-a-distance`,
  });

  await prisma.mailInRepair.update({
    where: { id: repairId },
    data: {
      quotedPrice: priceEuros,
      stripeSessionId: session.id,
      status: 'AWAITING_PAYMENT',
    },
  });

  const resend = getResendClient();
  if (resend && session.url) {
    try {
      await resend.emails.send({
        from: FROM,
        to: repair.customerEmail,
        replyTo: 'contact@reparmonphone.fr',
        subject: `Votre devis est prêt — réparation ${repair.deviceBrand} ${repair.deviceModel}`,
        html: `
          <div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px; margin: 0 auto;">
            <div style="background:#1e3a8a; padding: 24px; border-radius: 8px 8px 0 0; text-align: center;">
              <h1 style="color:#ffffff; font-size: 20px; margin: 0;">Votre appareil est prêt à repartir 🎉</h1>
            </div>
            <div style="background:#ffffff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; padding: 24px;">
              <p style="color:#374151; font-size: 14px; line-height: 1.6;">
                Bonjour ${repair.customerName}, votre <strong>${repair.deviceBrand} ${repair.deviceModel}</strong>
                a bien été diagnostiqué et réparé. Il ne reste plus qu'à régler le montant ci-dessous pour
                qu'on vous le renvoie immédiatement en Chronopost 24h.
              </p>
              <p style="color:#111827; font-size: 24px; font-weight: 700; text-align:center; margin: 20px 0 4px;">
                ${priceEuros.toFixed(2)} €
              </p>
              <p style="color:#6b7280; font-size: 12px; text-align:center; margin: 0 0 20px;">
                Frais de renvoi Chronopost 24h inclus — rien à payer en plus.
              </p>
              <div style="text-align:center; margin: 20px 0;">
                <a href="${session.url}" style="display:inline-block; background:#16a34a; color:#fff; text-decoration:none; padding: 12px 28px; border-radius: 8px; font-size: 15px; font-weight: 700;">Payer et faire renvoyer mon appareil</a>
              </div>
              <p style="color:#6b7280; font-size: 13px; margin-top: 20px;">
                Dès le paiement confirmé, on prépare l'envoi Chronopost 24h.
              </p>
            </div>
          </div>
        `,
      });
    } catch (e) {
      console.error("Erreur lors de l'envoi du lien de paiement (réparation par correspondance)", e);
      return { error: "Lien de paiement créé, mais l'email n'a pas pu être envoyé. Vérifie la config Resend." };
    }
  }

  revalidatePath(`/admin/reparation-a-distance/${repairId}`);
  revalidatePath('/admin/reparation-a-distance');

  return { ok: true, url: session.url };
}

// Infos logistiques internes : suivi aller (envoyé par le client, Chronopost ou Colissimo
// recommandé), suivi retour (une fois réparé et payé, toujours Chronopost), transporteur retour,
// et note interne jamais visible du client.
export async function updateMailInRepairLogistics(
  repairId: string,
  data: {
    inboundTrackingNumber?: string;
    inboundCarrier?: ShippingCarrier;
    outboundTrackingNumber?: string;
    outboundCarrier?: ShippingCarrier;
    adminNote?: string;
  }
) {
  await requireAdminUser();
  await prisma.mailInRepair.update({
    where: { id: repairId },
    data: {
      inboundTrackingNumber: data.inboundTrackingNumber || undefined,
      inboundCarrier: data.inboundCarrier || undefined,
      outboundTrackingNumber: data.outboundTrackingNumber || undefined,
      outboundCarrier: data.outboundCarrier || undefined,
      adminNote: data.adminNote,
      // Renseigner un suivi de renvoi vaut confirmation que l'appareil est reparti.
      ...(data.outboundTrackingNumber ? { status: 'SHIPPED_BACK' as const } : {}),
    },
  });
  revalidatePath(`/admin/reparation-a-distance/${repairId}`);
  revalidatePath('/admin/reparation-a-distance');
}

// Photos de l'appareil RÉPARÉ, ajoutées par l'admin avant le renvoi — visibles du client sur ses
// pages de suivi (public et espace compte). Remplace la liste entière (comme les autres champs de
// ce fichier) : c'est PhotoUploader qui gère l'ajout/retrait côté client avant l'enregistrement.
export async function updateMailInRepairPhotos(repairId: string, repairedPhotos: string[]) {
  await requireAdminUser();
  await prisma.mailInRepair.update({ where: { id: repairId }, data: { repairedPhotos } });
  revalidatePath(`/admin/reparation-a-distance/${repairId}`);
  revalidatePath('/admin/reparation-a-distance');
  revalidatePath('/reparation-a-distance/suivi/[id]', 'page');
  revalidatePath('/compte/reparation-a-distance/[id]', 'page');
}
