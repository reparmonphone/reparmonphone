import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { generateInvoicePdf } from '@/lib/invoicePdf';
import { getResendClient } from '@/lib/resend';
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
    const billingAddress = session.customer_details?.address;
    const billingName = session.customer_details?.name;

    // Détails de la carte utilisée (marque + 4 derniers chiffres), pour affichage sur la facture
    let paymentBrand: string | undefined;
    let paymentLast4: string | undefined;
    if (session.payment_intent) {
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent as string, {
          expand: ['payment_method'],
        });
        const pm = paymentIntent.payment_method;
        if (pm && typeof pm !== 'string' && pm.card) {
          paymentBrand = pm.card.brand;
          paymentLast4 = pm.card.last4;
        }
      } catch (e) {
        console.error('Impossible de récupérer les détails du moyen de paiement', e);
      }
    }

    const data = {
      status: 'PAID' as const,
      stripePaymentIntentId: (session.payment_intent as string) ?? undefined,
      customerName: shippingName ?? session.customer_details?.name ?? undefined,
      customerEmail: session.customer_details?.email ?? undefined,
      customerPhone: session.customer_details?.phone ?? undefined,
      shippingLine1: shippingAddress?.line1 ?? undefined,
      shippingCity: shippingAddress?.city ?? undefined,
      shippingZip: shippingAddress?.postal_code ?? undefined,
      billingName: billingName ?? undefined,
      billingLine1: billingAddress?.line1 ?? undefined,
      billingCity: billingAddress?.city ?? undefined,
      billingZip: billingAddress?.postal_code ?? undefined,
      paymentBrand,
      paymentLast4,
    };

    // On ne garde que les champs réellement renvoyés par Stripe (pas d'écrasement par des undefined)
    const cleanData = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));

    let updatedOrder;
    try {
      if (orderId) {
        updatedOrder = await prisma.order.update({
          where: { id: orderId },
          data: cleanData,
          include: { items: { include: { product: true } } },
        });
      } else {
        // Filet de sécurité si jamais orderId n'était pas dans les metadata
        await prisma.order.updateMany({ where: { stripeSessionId: session.id }, data: cleanData });
        updatedOrder = await prisma.order.findFirst({
          where: { stripeSessionId: session.id },
          include: { items: { include: { product: true } } },
        });
      }
    } catch (e) {
      console.error('Impossible de mettre à jour la commande depuis le webhook', e);
    }

    // Envoi automatique de la facture par email si Resend est configuré (voir README)
    if (updatedOrder) {
      try {
        const resend = getResendClient();
        if (resend) {
          const pdfBuffer = await generateInvoicePdf({
            invoiceNumber: updatedOrder.invoiceNumber,
            createdAt: updatedOrder.createdAt,
            customerName: updatedOrder.customerName,
            customerEmail: updatedOrder.customerEmail,
            customerPhone: updatedOrder.customerPhone,
            shippingLine1: updatedOrder.shippingLine1,
            shippingCity: updatedOrder.shippingCity,
            shippingZip: updatedOrder.shippingZip,
            billingName: updatedOrder.billingName,
            billingLine1: updatedOrder.billingLine1,
            billingCity: updatedOrder.billingCity,
            billingZip: updatedOrder.billingZip,
            subtotal: Number(updatedOrder.subtotal),
            promoCode: updatedOrder.promoCode,
            discountAmount: Number(updatedOrder.discountAmount),
            shippingCost: Number(updatedOrder.shippingCost),
            total: Number(updatedOrder.total),
            paymentBrand: updatedOrder.paymentBrand,
            paymentLast4: updatedOrder.paymentLast4,
            carrier: updatedOrder.carrier,
            trackingNumber: updatedOrder.trackingNumber,
            items: updatedOrder.items.map((i) => ({
              title: i.product.title,
              quantity: i.quantity,
              unitPrice: Number(i.unitPrice),
            })),
          });
          const invoiceLabel = `${updatedOrder.createdAt.getFullYear()}-${String(updatedOrder.invoiceNumber).padStart(5, '0')}`;
          await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL ?? 'ReparMonPhone <contact@reparmonphone.fr>',
            to: updatedOrder.customerEmail,
            subject: `Confirmation de commande — Facture n° ${invoiceLabel}`,
            html: `<p>Bonjour ${updatedOrder.customerName},</p><p>Merci pour ta commande ! Ta facture n° ${invoiceLabel} est en pièce jointe.</p><p>L'équipe ReparMonPhone</p>`,
            attachments: [{ filename: `facture-reparmonphone-${invoiceLabel}.pdf`, content: pdfBuffer }],
          });
        }
      } catch (e) {
        console.error("Impossible d'envoyer l'email de confirmation avec la facture", e);
      }
    }
  }

  return NextResponse.json({ received: true });
}
