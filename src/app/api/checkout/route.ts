import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { validatePromoCode } from '@/lib/promoCode';

export async function POST(req: NextRequest) {
  const { items, shippingOptionId, promoCode } = await req.json();

  if (!items || items.length === 0) {
    return NextResponse.json({ error: 'Panier vide' }, { status: 400 });
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

  // Revalidation du code promo côté serveur — ne jamais faire confiance à la réduction affichée côté client
  let discountAmount = 0;
  let appliedPromoCode: string | undefined;
  let stripeCouponId: string | undefined;
  if (promoCode) {
    const validation = await validatePromoCode(promoCode, subtotal);
    if (validation.ok) {
      discountAmount = validation.discount;
      appliedPromoCode = validation.code;
      // Stripe n'accepte pas de ligne à montant négatif : on passe par un coupon Stripe généré à la volée
      const promo = await prisma.promoCode.findUnique({ where: { code: validation.code } });
      const coupon = await stripe.coupons.create(
        promo?.type === 'PERCENT'
          ? { percent_off: Number(promo.value), duration: 'once' }
          : { amount_off: Math.round(discountAmount * 100), currency: 'eur', duration: 'once' }
      );
      stripeCouponId = coupon.id;
    }
  }

  const total = Math.max(0, subtotal + shippingCost - discountAmount);

  // Si le client est connecté, on rattache la commande à son compte (sinon commande "invité")
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // On crée la commande tout de suite en PENDING — les infos client/livraison définitives
  // (nom, adresse) ne sont connues qu'après saisie sur la page Stripe et seront complétées par le webhook.
  const order = await prisma.order.create({
    data: {
      userId: user?.id,
      customerName: user?.user_metadata?.full_name ?? 'À compléter',
      customerEmail: user?.email ?? 'a-completer@reparmonphone.fr',
      shippingLine1: 'À compléter',
      shippingCity: 'À compléter',
      shippingZip: 'À compléter',
      subtotal,
      shippingCost,
      promoCode: appliedPromoCode,
      discountAmount,
      total,
      status: 'PENDING',
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

  const lineItems = orderItemsData.map((i: { product: { title: string; imageUrl: string | null; price: unknown }; quantity: number }) => ({
    price_data: {
      currency: 'eur',
      product_data: {
        name: i.product.title,
        images: i.product.imageUrl ? [i.product.imageUrl] : [],
      },
      unit_amount: Math.round(Number(i.product.price) * 100),
    },
    quantity: i.quantity,
  }));

  if (shippingOption && shippingCost > 0) {
    lineItems.push({
      price_data: {
        currency: 'eur',
        product_data: { name: `Livraison — ${shippingOption.label}`, images: [] },
        unit_amount: Math.round(shippingCost * 100),
      },
      quantity: 1,
    });
  }

  const origin = req.headers.get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: lineItems,
    discounts: stripeCouponId ? [{ coupon: stripeCouponId }] : undefined,
    shipping_address_collection: { allowed_countries: ['FR'] },
    billing_address_collection: 'required',
    customer_email: user?.email ?? undefined,
    metadata: { orderId: order.id },
    success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/panier`,
  });

  // On mémorise l'id de session Stripe sur la commande pour la retrouver depuis le webhook.
  await prisma.order.update({ where: { id: order.id }, data: { stripeSessionId: session.id } });

  return NextResponse.json({ url: session.url });
}
