'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdminUser } from '@/lib/supabase-server';
import { getResendClient } from '@/lib/resend';
import type { AppointmentStatus } from '@prisma/client';

const FROM = process.env.RESEND_FROM_EMAIL ?? 'ReparMonPhone <contact@reparmonphone.fr>';

export async function updateAppointmentStatus(appointmentId: string, status: AppointmentStatus) {
  await requireAdminUser();
  await prisma.appointment.update({ where: { id: appointmentId }, data: { status } });
  revalidatePath('/admin/rdv');
  revalidatePath(`/admin/rdv/${appointmentId}`);
}

export async function sendAppointmentReply(appointmentId: string, replyMessage: string) {
  await requireAdminUser();

  if (!replyMessage.trim()) {
    return { error: 'Le message de réponse est vide.' };
  }

  const appointment = await prisma.appointment.findUnique({ where: { id: appointmentId } });
  if (!appointment) return { error: 'Rendez-vous introuvable.' };

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { adminReply: replyMessage, repliedAt: new Date() },
  });

  const resend = getResendClient();
  if (resend) {
    try {
      await resend.emails.send({
        from: FROM,
        to: appointment.customerEmail,
        replyTo: 'contact@reparmonphone.fr',
        subject: `Réponse à votre demande de rendez-vous — ReparMonPhone`,
        html: `
          <div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px; margin: 0 auto;">
            <div style="background:#1e3a8a; padding: 24px; border-radius: 8px 8px 0 0; text-align: center;">
              <h1 style="color:#ffffff; font-size: 20px; margin: 0;">Réponse à votre demande de rendez-vous</h1>
            </div>
            <div style="background:#ffffff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; padding: 24px;">
              <p style="color:#374151; font-size: 14px; line-height: 1.6;">
                Bonjour ${appointment.customerName},
              </p>
              <p style="color:#374151; font-size: 14px; line-height: 1.6; white-space: pre-line; background:#f9fafb; border-radius:8px; padding:16px; margin: 16px 0;">
                ${replyMessage}
              </p>
              <p style="color:#6b7280; font-size: 13px; margin-top: 20px;">
                Rappel de votre demande initiale : <strong>${appointment.deviceBrand} ${appointment.deviceModel}</strong>,
                le ${new Date(appointment.preferredDate).toLocaleString('fr-FR')}.
              </p>
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
      console.error("Erreur lors de l'envoi de la réponse au client", e);
      return { error: "Réponse enregistrée, mais l'email n'a pas pu être envoyé. Vérifie la config Resend." };
    }
  }

  revalidatePath(`/admin/rdv/${appointmentId}`);
  revalidatePath('/admin/rdv');

  return { ok: true };
}
