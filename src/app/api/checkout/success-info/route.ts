import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Endpoint public (pas d'auth) appelé depuis la page /checkout/success pour récupérer les infos
// nécessaires à (1) l'intégration "Google Avis clients" (Merchant Center) : numéro de commande, email
// client, date de commande, et (2) l'événement GA4 "purchase" (voir src/lib/gtmEvents.ts) : total,
// livraison, remise et détail des articles achetés. Sans risque : que ce soit le session_id Stripe ou
// l'order_id SumUp ou PayPal, ce sont des identifiants aléatoires non devinables, connus uniquement du
// client qui vient de payer (ils arrivent dans l'URL de redirection après paiement).
const orderSelect = {
  invoiceNumber: true,
  customerEmail: true,
  createdAt: true,
  total: true,
  shippingCost: true,
  promoCode: true,
  items: {
    select: {
      quantity: true,
      unitPrice: true,
      product: { select: { id: true, title: true } },
    },
  },
} as const;

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('session_id');
  const orderId = req.nextUrl.searchParams.get('order_id');
  if (!sessionId && !orderId) {
    return NextResponse.json({ error: 'session_id ou order_id manquant' }, { status: 400 });
  }

  const order = sessionId
    ? await prisma.order.findUnique({ where: { stripeSessionId: sessionId }, select: orderSelect })
    : await prisma.order.findUnique({ where: { id: orderId! }, select: orderSelect });

  if (!order) {
    return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });
  }

  return NextResponse.json({
    orderId: String(order.invoiceNumber),
    email: order.customerEmail,
    createdAt: order.createdAt,
    total: Number(order.total),
    shippingCost: Number(order.shippingCost),
    promoCode: order.promoCode,
    items: order.items.map((i: { product: { id: string; title: string }; unitPrice: unknown; quantity: number }) => ({
      item_id: i.product.id,
      item_name: i.product.title,
      price: Number(i.unitPrice),
      quantity: i.quantity,
    })),
  });
}
