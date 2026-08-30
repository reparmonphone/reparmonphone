import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createPaypalOrder } from '@/lib/paypal';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { validatePromoCode } from '@/lib/promoCode';
import { resolveShippingPrice } from '@/lib/shippingZones';

export async function POST(req: NextRequest) {
  const { items, shippingOptionId, customer, promoCode } = await req.json();

  if (!items || items.length === 0) {
    return NextResponse.json({ error: 'Panier vide' }, { status: 400 });
  }
  if (!customer?.name || !customer?.email || !customer?.addressLine1 || !customer?.addressZip || !customer?.addressCity) {
    return NextResponse.json({ error: 'Coordonnées et adresse obligatoires pour un paiement PayPal.' }, { status: 400 });
  }

  const shippingOption = shippingOptionId
    ? await prisma.shippingOption.findUnique({ where: { id: shippingOptionId } })
    : null;
  // Recalcul du tarif de livraison côté serveur selon le code postal réel — voir src/lib/shippingZones.ts.
  const effectiveZipForShipping = customer.shipDifferent ? customer.shipAddressZip : customer.addressZip;
  let shippingCost = 0;
  if (shippingOption) {
    const [zones, rates] = await Promise.all([
      prisma.shippingZone.findMany(),
      prisma.shippingZoneRate.findMany({ where: { shippingOptionId: shippingOption.id } }),
    ]);
    const resolved = resolveShippingPrice(
      { id: shippingOption.id, price: Number(shippingOption.price) },
      zones.map((z) => ({ id: z.id, name: z.name, postalPrefixes: z.postalPrefixes })),
      rates.map((r) => ({ shippingOptionId: r.shippingOptionId, zoneId: r.zoneId, price: Number(r.price) })),
      effectiveZipForShipping
    );
    shippingCost = resolved.price;
  }

  const productIds = items.map((i: { productId: string }) => i.productId);
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } });

  const orderItemsData = items.map((item: { productId: string; quantity: number }) => {
    const product = products.find((p: { id: string }) => p.id === item.productId);
    if (!product) throw new Error(`Produit introuvable: ${item.productId}`);
    return { product, quantity: item.quantity };
  });

  const subtotal = orderItemsData.reduce(
    (sum: number, i: { product: { price: unknown }; quantity: number }) => sum + Number(i.product.price) * i.quantity,
    0
  );
  // Revalidation du code promo côté serveur
  let discountAmount = 0;
  let appliedPromoCode: string | undefined;
  if (promoCode) {
    const validation = await validatePromoCode(promoCode, subtotal);
    if (validation.ok) {
      discountAmount = validation.discount;
      appliedPromoCode = validation.code;
    }
  }

  const total = Math.max(0, subtotal + shippingCost - discountAmount);

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Comme pour SumUp, on collecte l'adresse nous-mêmes plutôt que de dépendre du profil PayPal de l'acheteur.
  const shipLine1 = customer.shipDifferent ? customer.shipAddressLine1 : customer.addressLine1;
  const shipZip = customer.shipDifferent ? customer.shipAddressZip : customer.addressZip;
  const shipCity = customer.shipDifferent ? customer.shipAddressCity : customer.addressCity;

  const order = await prisma.order.create({
    data: {
      userId: user?.id,
      customerName: customer.shipDifferent ? customer.shipName : customer.name,
      customerEmail: customer.email,
      customerPhone: customer.phone ?? null,
      companyName: customer.company || null,
      shippingLine1: shipLine1,
      shippingZip: shipZip,
      shippingCity: shipCity,
      billingName: customer.shipDifferent ? customer.name : null,
      billingLine1: customer.shipDifferent ? customer.addressLine1 : null,
      billingZip: customer.shipDifferent ? customer.addressZip : null,
      billingCity: customer.shipDifferent ? customer.addressCity : null,
      subtotal,
      shippingCost,
      promoCode: appliedPromoCode,
      discountAmount,
      total,
      status: 'PENDING',
      paymentProvider: 'PAYPAL',
      items: {
        create: orderItemsData.map((i: { product: { id: string; price: unknown }; quantity: number }) => ({
          productId: i.product.id,
          quantity: i.quantity,
          unitPrice: i.product.price as never,
        })),
      },
    },
  });

  if (appliedPromoCode) {
    await prisma.promoCode.update({ where: { code: appliedPromoCode }, data: { usedCount: { increment: 1 } } });
  }

  const origin = req.headers.get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

  try {
    const paypalOrder = await createPaypalOrder({
      amount: total,
      reference: order.id,
      returnUrl: `${origin}/api/paypal-return?order_id=${order.id}`,
      cancelUrl: `${origin}/panier`,
    });

    await prisma.order.update({ where: { id: order.id }, data: { paypalOrderId: paypalOrder.id } });

    return NextResponse.json({ url: paypalOrder.approveUrl });
  } catch (e) {
    console.error('Erreur création commande PayPal', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erreur lors de la création du paiement PayPal.' },
      { status: 500 }
    );
  }
}
