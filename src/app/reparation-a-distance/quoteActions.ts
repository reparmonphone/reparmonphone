'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getResendClient } from '@/lib/resend';

const FROM = process.env.RESEND_FROM_EMAIL ?? 'ReparMonPhone <contact@reparmonphone.fr>';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.reparmonphone.fr';

// Action PUBLIQUE (pas de requireAdminUser) : le client accepte ou refuse le devis qu'on lui a envoyé
// par email (voir sendMailInRepairReply, dans admin/.../actions.ts). Appelée depuis sa page de suivi,
// publique ou espace compte. On revérifie côté serveur qu'un devis existe bien et n'a pas déjà été
// tranché, pour éviter un double clic ou un appel rejoué.
export async function respondToMailInRepairQuote(repairId: string, decision: 'ACCEPTED' | 'DECLINED') {
  const repair = await prisma.mailInRepair.findUnique({ where: { id: repairId } });
  if (!repair) return { error: 'Demande introuvable.' };

  if (repair.quoteDecision) {
    return { error: 'Ce devis a déjà été traité.' };
  }

  const latestQuote = await prisma.mailInRepairReply.findFirst({
    where: { mailInRepairId: repairId, quotedEstimate: { not: null } },
    orderBy: { createdAt: 'desc' },
  });
  if (!latestQuote) {
    return { error: 'Aucun devis en attente pour cette demande.' };
  }

  await prisma.mailInRepair.update({
    where: { id: repairId },
    data: {
      quoteDecision: decision,
      quoteDecisionAt: new Date(),
      ...(decision === 'ACCEPTED' && repair.status === 'REQUESTED' ? { status: 'AWAITING_DEVICE' as const } : {}),
      ...(decision === 'DECLINED' ? { status: 'CANCELLED' as const } : {}),
    },
  });

  const resend = getResendClient();
  if (resend) {
    try {
      await resend.emails.send({
        from: FROM,
        to: 'contact@reparmonphone.fr',
        replyTo: repair.customerEmail,
        subject:
          decision === 'ACCEPTED'
            ? `✅ Devis accepté — ${repair.customerName} (${repair.deviceBrand} ${repair.deviceModel})`
            : `❌ Devis refusé — ${repair.customerName} (${repair.deviceBrand} ${repair.deviceModel})`,
        html: `
          <div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px; margin: 0 auto;">
            <p style="font-size:14px; color:#374151;">
              ${repair.customerName} (${repair.customerEmail}) a
              <strong>${decision === 'ACCEPTED' ? 'accepté' : 'refusé'}</strong>
              le devis de ${Number(latestQuote.quotedEstimate).toFixed(2)} € pour son
              ${repair.deviceBrand} ${repair.deviceModel}.
            </p>
            <p style="font-size:13px; color:#6b7280;">
              <a href="${SITE_URL}/admin/reparation-a-distance/${repair.id}">Voir la demande dans l'admin</a>
            </p>
          </div>
        `,
      });
    } catch (e) {
      console.error("Erreur lors de l'envoi de la notification de décision de devis", e);
      // On ne bloque pas la décision du client si l'email de notification échoue.
    }
  }

  revalidatePath(`/reparation-a-distance/suivi/${repairId}`);
  revalidatePath(`/compte/reparation-a-distance/${repairId}`);
  revalidatePath(`/admin/reparation-a-distance/${repairId}`);
  revalidatePath('/admin/reparation-a-distance');

  return { ok: true, decision };
}
