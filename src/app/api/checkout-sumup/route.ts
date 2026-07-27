import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createSumupCheckout } from '@/lib/sumup';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { validatePromoCode } from '@/lib/promoCode';

export async function POST(req: NextRequest) {
  const { items, shippingOptionId, customer, promoCode } = await req.json();

  if (!items || items.length === 0) {
    return NextResponse.json({ error: 'Panier vide' }, { status: 400 });
  }
  if (!customer?.name || !customer?.email || !customer?.addressLine1 || !customer?.addressZip || !customer?.addressCity) {
    return NextResponse.json({ error: 'Coordonnées et adresse obligatoires pour un paiement SumUp.' }, { status: 400 });
  }

  const shippingOption = shippingOptionId
    ? await prisma.shippingOption.findUnique({ where: { id: shippingOptionId } })
    : null;
  const shippingCost = shippingOption ? Number(shippingOption.price) : 0;

  // Recalcul des prix côté serveur (ne jamais faire confiance au panier client)
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

  // Contrairement à Stripe, SumUp Hosted Checkout ne collecte pas l'adresse du client —
  // on l'enregistre donc directement avec les vraies infos saisies sur notre propre page panier.
  // Adresse de livraison = celle saisie comme "différente" si cochée, sinon identique à la facturation.
  // Adresse de facturation : seulement enregistrée explicitement si elle diffère de la livraison
  // (convention déjà utilisée par le webhook Stripe : billingLine1 = null signifie "identique à la livraison").
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
      paymentProvider: 'SUMUP',
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
    const checkout = await createSumupCheckout({
      amount: total,
      checkoutReference: order.id,
      description: `Commande ReparMonPhone #${order.id.slice(-8)}`,
      redirectUrl: `${origin}/checkout/success`,
      returnUrl: `${origin}/api/webhook-sumup`,
    });

    await prisma.order.update({ where: { id: order.id }, data: { sumupCheckoutId: checkout.id } });

    return NextResponse.json({ url: checkout.hosted_checkout_url });
  } catch (e) {
    console.error('Erreur création checkout SumUp', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erreur lors de la création du paiement SumUp.' },
      { status: 500 }
    );
  }
}
