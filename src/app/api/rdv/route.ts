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
  type: z.enum(['ATELIER', 'DOMICILE']),
  city: z.string().min(2),
  preferredDate: z.string(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
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

  let extraFee = 0;
  if (data.type === 'DOMICILE') {
    const zone = await prisma.serviceZone.findUnique({ where: { cityName: data.city } });
    extraFee = zone ? Number(zone.extraFee) : 0;
  }

  // Si le client est connecté, on rattache le RDV à son compte (sinon RDV "invité")
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const appointment = await prisma.appointment.create({
    data: {
      ...data,
      preferredDate: new Date(data.preferredDate),
      extraFee,
      userId: user?.id,
    },
  });

  // Notifications email — n'empêchent jamais la création du RDV de réussir si l'envoi échoue
  const resend = getResendClient();
  if (resend) {
    const dateLabel = new Date(data.preferredDate).toLocaleString('fr-FR');
    const typeLabel = data.type === 'DOMICILE' ? `🏠 Domicile (${data.city})` : '🔧 Atelier';

    // Notification à l'admin
    try {
      await resend.emails.send({
        from: FROM,
        to: ADMIN_EMAIL,
        replyTo: data.customerEmail,
        subject: `📅 Nouvelle demande de RDV — ${data.customerName}`,
        html: `
          <div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px; margin: 0 auto;">
            <div style="background:#1e3a8a; padding: 24px; border-radius: 8px 8px 0 0; text-align: center;">
              <h1 style="color:#ffffff; font-size: 20px; margin: 0;">Nouvelle demande de rendez-vous</h1>
            </div>
            <div style="background:#ffffff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; padding: 24px;">
              <table style="width:100%; border-collapse: collapse; margin-bottom: 16px;">
                <tr><td style="padding:4px 0; color:#6b7280; font-size:13px; width:130px;">Client</td><td style="padding:4px 0; color:#111827; font-size:14px; font-weight:600;">${data.customerName}</td></tr>
                <tr><td style="padding:4px 0; color:#6b7280; font-size:13px;">Téléphone</td><td style="padding:4px 0; color:#111827; font-size:14px;"><a href="tel:${data.customerPhone}" style="color:#1e3a8a;">${data.customerPhone}</a></td></tr>
                <tr><td style="padding:4px 0; color:#6b7280; font-size:13px;">Email</td><td style="padding:4px 0; color:#111827; font-size:14px;"><a href="mailto:${data.customerEmail}" style="color:#1e3a8a;">${data.customerEmail}</a></td></tr>
                <tr><td style="padding:4px 0; color:#6b7280; font-size:13px;">Appareil</td><td style="padding:4px 0; color:#111827; font-size:14px;">${data.deviceBrand} ${data.deviceModel}</td></tr>
                <tr><td style="padding:4px 0; color:#6b7280; font-size:13px;">Type</td><td style="padding:4px 0; color:#111827; font-size:14px;">${typeLabel}${extraFee > 0 ? ` — +${extraFee}€` : ''}</td></tr>
                <tr><td style="padding:4px 0; color:#6b7280; font-size:13px;">Date souhaitée</td><td style="padding:4px 0; color:#111827; font-size:14px; font-weight:600;">${dateLabel}</td></tr>
              </table>
              ${
                data.latitude && data.longitude
                  ? `<p style="margin: 0 0 16px;"><a href="https://www.google.com/maps?q=${data.latitude},${data.longitude}" style="color:#1e3a8a; font-size:14px; font-weight:600;">📍 Voir l'emplacement exact sur la carte</a></p>`
                  : ''
              }
              <div style="border-top: 1px solid #e5e7eb; padding-top: 12px;">
                <p style="color:#6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 8px;">Description de la panne</p>
                <p style="color:#374151; font-size: 14px; line-height: 1.6; white-space: pre-line; margin: 0;">${data.issueDescription}</p>
              </div>
              <div style="text-align:center; margin-top: 20px;">
                <a href="${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.reparmonphone.fr'}/admin/rdv/${appointment.id}" style="display:inline-block; background:#1e3a8a; color:#fff; text-decoration:none; padding: 10px 24px; border-radius: 8px; font-size: 14px; font-weight: 600;">Voir et répondre</a>
              </div>
            </div>
          </div>
        `,
      });
    } catch (e) {
      console.error("Erreur lors de l'envoi de la notification RDV à l'admin", e);
    }

    // Confirmation au client
    try {
      await resend.emails.send({
        from: FROM,
        to: data.customerEmail,
        subject: `Votre demande de rendez-vous est bien reçue — ReparMonPhone`,
        html: `
          <div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px; margin: 0 auto;">
            <div style="background:#16a34a; padding: 24px; border-radius: 8px 8px 0 0; text-align: center;">
              <h1 style="color:#ffffff; font-size: 20px; margin: 0;">Demande bien reçue ✅</h1>
            </div>
            <div style="background:#ffffff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; padding: 24px;">
              <p style="color:#374151; font-size: 14px; line-height: 1.6;">
                Bonjour ${data.customerName}, merci pour votre demande de rendez-vous concernant votre
                <strong>${data.deviceBrand} ${data.deviceModel}</strong>. Nous revenons vers vous rapidement
                pour confirmer le créneau du <strong>${dateLabel}</strong>.
              </p>
              <p style="color:#6b7280; font-size: 13px; margin-top: 20px;">
                Une question en attendant ? Appelez-nous directement au
                <a href="tel:+33783497262" style="color:#16a34a;">07 83 49 72 62</a>.
              </p>
            </div>
          </div>
        `,
      });
    } catch (e) {
      console.error("Erreur lors de l'envoi de la confirmation RDV au client", e);
    }
  }

  return NextResponse.json({ appointment });
}
