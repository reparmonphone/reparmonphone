import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { capturePaypalOrder } from '@/lib/paypal';

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
      await prisma.order.update({
        where: { id: order.id },
        data: { status: 'PAID', paymentBrand: 'paypal' },
      });
      return NextResponse.redirect(`${origin}/checkout/success`);
    }

    return NextResponse.redirect(`${origin}/panier?error=paypal`);
  } catch (e) {
    console.error('Erreur capture PayPal', e);
    return NextResponse.redirect(`${origin}/panier?error=paypal`);
  }
}
