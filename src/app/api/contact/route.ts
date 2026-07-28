import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getResendClient } from '@/lib/resend';

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  requestType: z.string().optional(),
  subject: z.string().min(2),
  message: z.string().min(5),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { name, email, requestType, subject, message } = parsed.data;

  await prisma.contactMessage.create({
    data: { name, email, requestType, subject, message },
  });

  // Préfixe visuel selon le type de demande, pour trier/prioriser d'un coup d'œil dans la boîte mail.
  const REQUEST_TYPE_PREFIX: Record<string, string> = {
    Aide: '💬 Demande d\'aide',
    Bug: '🐞 Signalement de bug',
    Erreur: '⚠️ Erreur signalée',
    'Demande directe': '📩 Demande directe',
  };
  const emailSubjectPrefix = (requestType && REQUEST_TYPE_PREFIX[requestType]) || 'Nouveau message du site';

  // Notifie l'admin par email si Resend est configuré (sinon, le message reste consultable dans /admin/messages)
  const resend = getResendClient();
  if (resend) {
    try {
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? 'ReparMonPhone <contact@reparmonphone.fr>',
        to: 'contact@reparmonphone.fr',
        replyTo: email,
        subject: `${emailSubjectPrefix} — ${subject}`,
        html: `
          <div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px; margin: 0 auto;">
            <div style="background:#1e3a8a; padding: 20px 24px; border-radius: 8px 8px 0 0;">
              <h1 style="color:#ffffff; font-size: 18px; margin: 0;">Nouveau message via le formulaire de contact</h1>
              <p style="color:#dbeafe; font-size: 13px; margin: 4px 0 0;">ReparMonPhone.fr</p>
            </div>
            <div style="background:#ffffff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; padding: 24px;">
              <table style="width:100%; border-collapse: collapse; margin-bottom: 20px;">
                <tr>
                  <td style="padding: 6px 0; color:#6b7280; font-size: 13px; width: 100px;">Nom</td>
                  <td style="padding: 6px 0; color:#111827; font-size: 14px; font-weight: 600;">${name}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color:#6b7280; font-size: 13px;">Email</td>
                  <td style="padding: 6px 0; color:#111827; font-size: 14px;"><a href="mailto:${email}" style="color:#1e3a8a;">${email}</a></td>
                </tr>
                ${requestType ? `
                <tr>
                  <td style="padding: 6px 0; color:#6b7280; font-size: 13px;">Type de demande</td>
                  <td style="padding: 6px 0; color:#111827; font-size: 14px;">${requestType}</td>
                </tr>` : ''}
                <tr>
                  <td style="padding: 6px 0; color:#6b7280; font-size: 13px;">Sujet</td>
                  <td style="padding: 6px 0; color:#111827; font-size: 14px; font-weight: 600;">${subject}</td>
                </tr>
              </table>
              <div style="border-top: 1px solid #e5e7eb; padding-top: 16px;">
                <p style="color:#6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 8px;">Message</p>
                <p style="color:#374151; font-size: 14px; line-height: 1.6; white-space: pre-line; margin: 0;">${message}</p>
              </div>
            </div>
            <p style="color:#9ca3af; font-size: 12px; text-align: center; margin-top: 16px;">
              Message envoyé depuis le formulaire de contact de reparmonphone.fr — répondez directement à cet email pour contacter ${name}.
            </p>
          </div>
        `,
      });
    } catch (e) {
      console.error("Erreur lors de l'envoi de la notification email au contact", e);
    }
  }

  return NextResponse.json({ ok: true });
}
