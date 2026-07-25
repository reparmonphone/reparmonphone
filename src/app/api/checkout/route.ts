import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  const { items } = await req.json();

  if (!items || items.length === 0) {
    return NextResponse.json({ error: 'Panier vide' }, { status: 400 });
  }

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
      total: subtotal,
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

  const origin = req.headers.get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: lineItems,
    shipping_address_collection: { allowed_countries: ['FR'] },
    customer_email: user?.email ?? undefined,
    metadata: { orderId: order.id },
    success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/panier`,
  });

  // On mémorise l'id de session Stripe sur la commande pour la retrouver depuis le webhook.
  await prisma.order.update({ where: { id: order.id }, data: { stripeSessionId: session.id } });

  return NextResponse.json({ url: session.url });
}
