'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdminUser } from '@/lib/supabase-server';
import { getResendClient } from '@/lib/resend';

const FROM = process.env.RESEND_FROM_EMAIL ?? 'ReparMonPhone <contact@reparmonphone.fr>';

function generateCreditCode() {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `AVOIR-${random}`;
}

// Accorde un avoir : génère un code promo à usage unique, d'un montant fixe, et l'envoie au client.
// ⚠️ Le type "FIXED" suppose que c'est bien une valeur de l'enum PromoType de ton schéma — si le
// build affiche une erreur TypeScript ici, ouvre schema.prisma pour voir le nom exact de l'enum
// (ex: peut-être "MONTANT_FIXE" ou "AMOUNT" selon comment tu l'as nommé) et ajuste cette ligne.
export async function issueCredit(claimId: string, amount: number) {
  await requireAdminUser();

  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: 'Montant invalide.' };
  }

  const claim = await prisma.claim.findUnique({ where: { id: claimId }, include: { order: true } });
  if (!claim) return { error: 'Litige introuvable.' };

  const code = generateCreditCode();

  await prisma.promoCode.create({
    data: {
      code,
      type: 'FIXED',
      value: amount,
      maxUses: 1,
      active: true,
      expiresAt: null,
    },
  });

  await prisma.claim.update({
    where: { id: claimId },
    data: { status: 'CREDIT_ISSUED', creditCode: code, creditAmount: amount, resolvedAt: new Date() },
  });

  const resend = getResendClient();
  if (resend) {
    try {
      await resend.emails.send({
        from: FROM,
        to: claim.customerEmail,
        subject: `Un avoir de ${amount.toFixed(2)}€ vous a été accordé — ReparMonPhone`,
        html: `
          <div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px; margin: 0 auto;">
            <div style="background:#16a34a; padding: 24px; border-radius: 8px 8px 0 0; text-align: center;">
              <h1 style="color:#ffffff; font-size: 20px; margin: 0;">Avoir accordé ✅</h1>
            </div>
            <div style="background:#ffffff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; padding: 24px;">
              <p style="color:#374151; font-size: 14px; line-height: 1.6;">
                Suite à votre réclamation concernant la commande #${claim.order.invoiceNumber || claim.order.id.slice(-8)},
                nous vous accordons un avoir de <strong>${amount.toFixed(2)}€</strong>, utilisable sur votre
                prochaine commande.
              </p>
              <div style="background:#f0fdf4; border-radius: 8px; padding: 16px; margin: 16px 0; text-align: center;">
                <p style="color:#6b7280; font-size: 12px; text-transform: uppercase; margin: 0 0 6px;">Votre code</p>
                <p style="color:#111827; font-size: 22px; font-weight: 700; margin: 0; letter-spacing: 0.05em;">${code}</p>
              </div>
              <p style="color:#6b7280; font-size: 13px;">Ce code est valable une seule fois, sans date d'expiration.</p>
            </div>
          </div>
        `,
      });
    } catch (e) {
      console.error("Erreur envoi email avoir", e);
    }
  }

  revalidatePath('/admin/litiges');
  revalidatePath(`/admin/litiges/${claimId}`);
  return { ok: true, code };
}

export async function markAsRefunded(claimId: string, note: string) {
  await requireAdminUser();
  const claim = await prisma.claim.findUnique({ where: { id: claimId }, include: { order: true } });
  if (!claim) return { error: 'Litige introuvable.' };

  await prisma.$transaction([
    prisma.claim.update({
      where: { id: claimId },
      data: { status: 'REFUNDED', adminNote: note || null, resolvedAt: new Date() },
    }),
    prisma.order.update({ where: { id: claim.orderId }, data: { status: 'REFUNDED' } }),
  ]);

  revalidatePath('/admin/litiges');
  revalidatePath(`/admin/litiges/${claimId}`);
  revalidatePath('/admin/commandes');
  return { ok: true };
}

export async function rejectClaim(claimId: string, note: string) {
  await requireAdminUser();
  await prisma.claim.update({
    where: { id: claimId },
    data: { status: 'REJECTED', adminNote: note || null, resolvedAt: new Date() },
  });
  revalidatePath('/admin/litiges');
  revalidatePath(`/admin/litiges/${claimId}`);
  return { ok: true };
}
