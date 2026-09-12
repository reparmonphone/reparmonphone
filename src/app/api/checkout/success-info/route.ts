import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Endpoint public (pas d'auth) appelé depuis la page /checkout/success pour récupérer les quelques
// infos nécessaires à l'intégration "Google Avis clients" (Merchant Center) : numéro de commande,
// email client, date de commande. Sans risque : que ce soit le session_id Stripe ou l'order_id SumUp,
// ce sont des identifiants aléatoires non devinables, connus uniquement du client qui vient de payer
// (ils arrivent dans l'URL de redirection après paiement), et on ne renvoie que ces quelques champs
// non sensibles. (PayPal ne renvoie pas encore d'identifiant ici — à faire si besoin.)
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('session_id');
  const orderId = req.nextUrl.searchParams.get('order_id');
  if (!sessionId && !orderId) {
    return NextResponse.json({ error: 'session_id ou order_id manquant' }, { status: 400 });
  }

  const order = sessionId
    ? await prisma.order.findUnique({
        where: { stripeSessionId: sessionId },
        select: { invoiceNumber: true, customerEmail: true, createdAt: true },
      })
    : await prisma.order.findUnique({
        where: { id: orderId! },
        select: { invoiceNumber: true, customerEmail: true, createdAt: true },
      });

  if (!order) {
    return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });
  }

  return NextResponse.json({
    orderId: String(order.invoiceNumber),
    email: order.customerEmail,
    createdAt: order.createdAt,
  });
}
