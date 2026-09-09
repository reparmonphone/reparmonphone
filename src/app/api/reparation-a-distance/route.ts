import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getResendClient } from '@/lib/resend';

const schema = z.object({
  customerName: z.string().min(2),
  customerEmail: z.string().email(),
  customerPhone: z.string().min(6),
  deviceBrand: z.string().min(1),
  deviceModel: z.string().min(1),
  issueDescription: z.string().min(5),
  clientPhotos: z.array(z.string().url()).max(6).optional(),
});

const FROM = process.env.RESEND_FROM_EMAIL ?? 'ReparMonPhone <contact@reparmonphone.fr>';
const ADMIN_EMAIL = 'contact@reparmonphone.fr';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  // Si le client est connecté, on rattache la demande à son compte (sinon demande "invité")
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const repair = await prisma.mailInRepair.create({
    data: {
      ...data,
      userId: user?.id,
    },
  });

  // Notifications email — n'empêchent jamais la création de la demande de réussir si l'envoi échoue
  const resend = getResendClient();
  if (resend) {
    // Notification à l'admin
    try {
      await resend.emails.send({
        from: FROM,
        to: ADMIN_EMAIL,
        replyTo: data.customerEmail,
        subject: `📮 Nouvelle demande de réparation par correspondance — ${data.customerName}`,
        html: `
          <div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px; margin: 0 auto;">
            <div style="background:#1e3a8a; padding: 24px; border-radius: 8px 8px 0 0; text-align: center;">
              <h1 style="color:#ffffff; font-size: 20px; margin: 0;">Nouvelle demande — réparation par correspondance</h1>
            </div>
            <div style="background:#ffffff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; padding: 24px;">
              <table style="width:100%; border-collapse: collapse; margin-bottom: 16px;">
                <tr><td style="padding:4px 0; color:#6b7280; font-size:13px; width:130px;">Client</td><td style="padding:4px 0; color:#111827; font-size:14px; font-weight:600;">${data.customerName}</td></tr>
                <tr><td style="padding:4px 0; color:#6b7280; font-size:13px;">Téléphone</td><td style="padding:4px 0; color:#111827; font-size:14px;"><a href="tel:${data.customerPhone}" style="color:#1e3a8a;">${data.customerPhone}</a></td></tr>
                <tr><td style="padding:4px 0; color:#6b7280; font-size:13px;">Email</td><td style="padding:4px 0; color:#111827; font-size:14px;"><a href="mailto:${data.customerEmail}" style="color:#1e3a8a;">${data.customerEmail}</a></td></tr>
                <tr><td style="padding:4px 0; color:#6b7280; font-size:13px;">Appareil</td><td style="padding:4px 0; color:#111827; font-size:14px;">${data.deviceBrand} ${data.deviceModel}</td></tr>
              </table>
              <div style="border-top: 1px solid #e5e7eb; padding-top: 12px;">
                <p style="color:#6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 8px;">Description de la panne</p>
                <p style="color:#374151; font-size: 14px; line-height: 1.6; white-space: pre-line; margin: 0;">${data.issueDescription}</p>
              </div>
              <p style="color:#b45309; font-size: 13px; margin-top: 16px; background:#fffbeb; border:1px solid #fde68a; border-radius:8px; padding:10px;">
                ⚠️ Penser à indiquer l'adresse d'envoi dans ta réponse — elle n'est jamais communiquée avant.
              </p>
              <div style="text-align:center; margin-top: 20px;">
                <a href="${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.reparmonphone.fr'}/admin/reparation-a-distance/${repair.id}" style="display:inline-block; background:#1e3a8a; color:#fff; text-decoration:none; padding: 10px 24px; border-radius: 8px; font-size: 14px; font-weight: 600;">Voir et répondre</a>
              </div>
            </div>
          </div>
        `,
      });
    } catch (e) {
      console.error("Erreur lors de l'envoi de la notification réparation par correspondance à l'admin", e);
    }

    // Confirmation au client — volontairement SANS adresse d'envoi à ce stade
    try {
      await resend.emails.send({
        from: FROM,
        to: data.customerEmail,
        subject: `Votre demande de réparation par correspondance est bien reçue — ReparMonPhone`,
        html: `
          <div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px; margin: 0 auto;">
            <div style="background:#16a34a; padding: 24px; border-radius: 8px 8px 0 0; text-align: center;">
              <h1 style="color:#ffffff; font-size: 20px; margin: 0;">Demande bien reçue ✅</h1>
            </div>
            <div style="background:#ffffff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; padding: 24px;">
              <p style="color:#374151; font-size: 14px; line-height: 1.6;">
                Bonjour ${data.customerName}, merci pour votre demande de réparation par correspondance
                concernant votre <strong>${data.deviceBrand} ${data.deviceModel}</strong>. Nous revenons
                vers vous rapidement avec une estimation.
              </p>
              <div style="background:#fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 14px 16px; margin: 20px 0;">
                <p style="color:#92400e; font-size: 14px; line-height: 1.6; margin:0; font-weight:600;">
                  ⚠️ N'envoyez pas encore votre appareil.
                </p>
                <p style="color:#92400e; font-size: 13px; line-height: 1.6; margin:6px 0 0;">
                  L'adresse d'envoi ne vous sera communiquée que dans notre prochain email, une fois
                  votre demande validée. Merci d'attendre cette confirmation avant tout envoi, afin
                  d'éviter un envoi à une mauvaise adresse.
                </p>
              </div>
              <p style="color:#6b7280; font-size: 13px; margin-top: 20px;">
                Une question en attendant ? Appelez-nous directement au
                <a href="tel:+33783497262" style="color:#16a34a;">07 83 49 72 62</a>.
              </p>
            </div>
          </div>
        `,
      });
    } catch (e) {
      console.error("Erreur lors de l'envoi de la confirmation réparation par correspondance au client", e);
    }
  }

  return NextResponse.json({ repair });
}
