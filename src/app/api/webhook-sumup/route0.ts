import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSumupCheckout } from '@/lib/sumup';

export async function POST(req: NextRequest) {
  let body: { event_type?: string; id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps invalide' }, { status: 400 });
  }

  const checkoutId = body.id;
  if (!checkoutId) {
    return NextResponse.json({ received: true }); // rien à traiter, on répond quand même 2xx
  }

  // SumUp ne signe pas ses notifications — on ne fait donc jamais confiance au contenu reçu et on
  // revérifie systématiquement le vrai statut du checkout via l'API avant de valider la commande.
  try {
    const checkout = await getSumupCheckout(checkoutId);

    if (checkout.status === 'PAID') {
      const paymentType = checkout.transactions?.[0]?.payment_type ?? null;
      await prisma.order.updateMany({
        where: { sumupCheckoutId: checkoutId },
        data: {
          status: 'PAID',
          paymentBrand: paymentType,
        },
      });
    } else if (checkout.status === 'FAILED') {
      await prisma.order.updateMany({
        where: { sumupCheckoutId: checkoutId, status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });
    }
  } catch (e) {
    console.error('Erreur traitement webhook SumUp', e);
    // On répond quand même 2xx pour éviter des retries infinis sur une erreur de notre côté qui ne se résoudra pas seule.
  }

  return NextResponse.json({ received: true });
}
