import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { capturePaypalOrder } from '@/lib/paypal';
import { sendOrderConfirmedEmails } from '@/lib/orderEmails';

export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get('order_id');
  // PayPal renvoie aussi son propre "token", qui est en fait l'id de la commande PayPal (identique à celui qu'on a stocké)
  const paypalToken = req.nextUrl.searchParams.get('token');

  const origin = req.nextUrl.origin;

  if (!orderId || !paypalToken) {
    return NextResponse.redirect(`${origin}/panier?error=paypal`);
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.paypalOrderId !== paypalToken) {
    return NextResponse.redirect(`${origin}/panier?error=paypal`);
  }

  try {
    const capture = await capturePaypalOrder(paypalToken);
    const captureStatus = capture.purchase_units?.[0]?.payments?.captures?.[0]?.status;

    if (capture.status === 'COMPLETED' || captureStatus === 'COMPLETED') {
      const wasAlreadyPaid = order.status === 'PAID';

      await prisma.order.update({
        where: { id: order.id },
        data: { status: 'PAID', paymentBrand: 'paypal' },
      });

      // Notification (client + admin) uniquement lors du premier passage réel en PAID —
      // évite un doublon si l'utilisateur revient sur cette URL de retour plusieurs fois
      // (rechargement de page, double-clic, etc.).
      if (!wasAlreadyPaid) {
        await sendOrderConfirmedEmails(order.id);
      }

      // order_id ajouté à l'URL (même principe que Stripe/SumUp, voir /api/checkout et
      // /api/checkout-sumup) pour que la page de succès puisse identifier la commande : intégration
      // "Google Avis clients" et événement GA4 "purchase" (voir src/lib/gtmEvents.ts). order.id est un
      // identifiant cuid aléatoire non devinable, donc sans risque à exposer dans l'URL.
      return NextResponse.redirect(`${origin}/checkout/success?order_id=${order.id}`);
    }

    return NextResponse.redirect(`${origin}/panier?error=paypal`);
  } catch (e) {
    console.error('Erreur capture PayPal', e);
    return NextResponse.redirect(`${origin}/panier?error=paypal`);
  }
}
