import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getResendClient } from '@/lib/resend';

const schema = z.object({
  trackingNumber: z.string().trim().min(4, 'Numéro de suivi trop court.').max(60),
});

const FROM = process.env.RESEND_FROM_EMAIL ?? 'ReparMonPhone <contact@reparmonphone.fr>';
const ADMIN_EMAIL = 'contact@reparmonphone.fr';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.reparmonphone.fr';

// Endpoint public : le lien contenant l'id (cuid, non devinable) fait office de jeton d'accès —
// exactement comme /reparation-a-distance/suivi/[id], envoyé au client uniquement une fois sa
// demande validée par email. Aucune authentification n'est donc requise ici.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const repair = await prisma.mailInRepair.findUnique({ where: { id: params.id } });
  if (!repair) {
    return NextResponse.json({ error: 'Demande introuvable.' }, { status: 404 });
  }

  const previousTracking = repair.inboundTrackingNumber;

  await prisma.mailInRepair.update({
    where: { id: params.id },
    data: { inboundTrackingNumber: parsed.data.trackingNumber },
  });

  // On notifie l'admin uniquement si c'est un nouveau numéro (pas à chaque simple correction mineure
  // répétée), pour ne pas noyer la boîte mail — mais on notifie quand même si le client corrige.
  if (previousTracking !== parsed.data.trackingNumber) {
    const resend = getResendClient();
    if (resend) {
      try {
        await resend.emails.send({
          from: FROM,
          to: ADMIN_EMAIL,
          subject: `📦 Suivi Chronopost renseigné par ${repair.customerName} — ${repair.deviceBrand} ${repair.deviceModel}`,
          html: `
            <div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px; margin: 0 auto;">
              <div style="background:#1e3a8a; padding: 24px; border-radius: 8px 8px 0 0; text-align: center;">
                <h1 style="color:#ffffff; font-size: 20px; margin: 0;">Numéro de suivi reçu du client</h1>
              </div>
              <div style="background:#ffffff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; padding: 24px;">
                <p style="color:#374151; font-size: 14px; line-height: 1.6;">
                  ${repair.customerName} (${repair.deviceBrand} ${repair.deviceModel}) a renseigné le numéro
                  de suivi de son envoi Chronopost :
                </p>
                <p style="color:#111827; font-size: 18px; font-weight: 700; text-align:center; margin: 16px 0; letter-spacing: 0.03em;">
                  ${parsed.data.trackingNumber}
                </p>
                <div style="text-align:center; margin-top: 20px;">
                  <a href="${SITE_URL}/admin/reparation-a-distance/${repair.id}" style="display:inline-block; background:#1e3a8a; color:#fff; text-decoration:none; padding: 10px 24px; border-radius: 8px; font-size: 14px; font-weight: 600;">Voir la demande</a>
                </div>
              </div>
            </div>
          `,
        });
      } catch (e) {
        console.error("Erreur lors de la notification admin (suivi client renseigné)", e);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
