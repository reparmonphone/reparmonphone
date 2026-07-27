import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { generateInvoicePdf } from '@/lib/invoicePdf';

export async function GET(req: NextRequest, { params }: { params: { orderId: string } }) {
  const order = await prisma.order.findUnique({
    where: { id: params.orderId },
    include: { items: { include: { product: true } } },
  });

  if (!order) {
    return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });
  }

  // Contrôle d'accès : le propriétaire de la commande ou un admin uniquement.
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isOwner = user && (order.userId === user.id || order.customerEmail === user.email);
  const isAdmin = user?.app_metadata?.role === 'admin';

  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
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

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      // "inline" : s'ouvre dans le navigateur, qui propose imprimer/enregistrer via sa propre visionneuse PDF
      'Content-Disposition': `inline; filename="facture-reparmonphone-${invoiceLabel}.pdf"`,
    },
  });
}
