import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature')!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error('Webhook signature invalide', err);
    return NextResponse.json({ error: 'Signature invalide' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;

    const orderId = session.metadata?.orderId;
    const shippingAddress = session.shipping_details?.address ?? session.customer_details?.address;
    const shippingName = session.shipping_details?.name ?? session.customer_details?.name;

    const data = {
      status: 'PAID' as const,
      stripePaymentIntentId: (session.payment_intent as string) ?? undefined,
      customerName: shippingName ?? session.customer_details?.name ?? undefined,
      customerEmail: session.customer_details?.email ?? undefined,
      customerPhone: session.customer_details?.phone ?? undefined,
      shippingLine1: shippingAddress?.line1 ?? undefined,
      shippingCity: shippingAddress?.city ?? undefined,
      shippingZip: shippingAddress?.postal_code ?? undefined,
    };

    // On ne garde que les champs réellement renvoyés par Stripe (pas d'écrasement par des undefined)
    const cleanData = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));

    try {
      if (orderId) {
        await prisma.order.update({ where: { id: orderId }, data: cleanData });
      } else {
        // Filet de sécurité si jamais orderId n'était pas dans les metadata
        await prisma.order.updateMany({ where: { stripeSessionId: session.id }, data: cleanData });
      }
    } catch (e) {
      console.error('Impossible de mettre à jour la commande depuis le webhook', e);
    }

    // TODO : brancher un envoi d'email de confirmation de commande ici (Resend, Postmark...).
  }

  return NextResponse.json({ received: true });
}
