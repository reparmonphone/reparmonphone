import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { generateInvoicePdf } from '@/lib/invoicePdf';
import { getResendClient } from '@/lib/resend';

const schema = z.object({ email: z.string().email().optional() });

export async function POST(req: NextRequest, { params }: { params: { orderId: string } }) {
  const order = await prisma.order.findUnique({
    where: { id: params.orderId },
    include: { items: { include: { product: true } } },
  });

  if (!order) {
    return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isOwner = user && (order.userId === user.id || order.customerEmail === user.email);
  const isAdmin = user?.app_metadata?.role === 'admin';

  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  // Un admin peut envoyer à une adresse de son choix (ex: renvoyer au client) ; un client reçoit toujours sur son propre email.
  const targetEmail = isAdmin && parsed.data?.email ? parsed.data.email : order.customerEmail;

  const resend = getResendClient();
  if (!resend) {
    return NextResponse.json(
      { error: "Envoi d'email non configuré. Ajoute RESEND_API_KEY dans .env (voir README)." },
      { status: 400 }
    );
  }

  const pdfBuffer = await generateInvoicePdf({
    invoiceNumber: order.invoiceNumber,
    createdAt: order.createdAt,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
    shippingLine1: order.shippingLine1,
    shippingCity: order.shippingCity,
    shippingZip: order.shippingZip,
    billingName: order.billingName,
    billingLine1: order.billingLine1,
    billingCity: order.billingCity,
    billingZip: order.billingZip,
    subtotal: Number(order.subtotal),
    promoCode: order.promoCode,
    discountAmount: Number(order.discountAmount),
    shippingCost: Number(order.shippingCost),
    total: Number(order.total),
    paymentBrand: order.paymentBrand,
    paymentLast4: order.paymentLast4,
    carrier: order.carrier,
    trackingNumber: order.trackingNumber,
    items: order.items.map((i) => ({
      title: i.product.title,
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice),
    })),
  });

  const invoiceLabel = `${order.createdAt.getFullYear()}-${String(order.invoiceNumber).padStart(5, '0')}`;

  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? 'ReparMonPhone <contact@reparmonphone.fr>',
      to: targetEmail,
      subject: `Ta facture ReparMonPhone n° ${invoiceLabel}`,
      html: `<p>Bonjour ${order.customerName},</p><p>Voici la facture de ta commande n° ${invoiceLabel}, en pièce jointe.</p><p>Merci de ta confiance !<br/>L'équipe ReparMonPhone</p>`,
      attachments: [{ filename: `facture-reparmonphone-${invoiceLabel}.pdf`, content: pdfBuffer }],
    });
  } catch (e) {
    console.error('Erreur envoi facture par email', e);
    return NextResponse.json({ error: "Erreur lors de l'envoi de l'email." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sentTo: targetEmail });
}
