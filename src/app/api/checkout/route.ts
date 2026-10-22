import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { validatePromoCode } from '@/lib/promoCode';
import { getClientIp } from '@/lib/clientIp';
import { checkBanForRequest, banResponse } from '@/lib/bannedClients';
import { resolveShippingPrice, findShippingZone, isShippingOptionAvailable } from '@/lib/shippingZones';
import { DOMTOM_STRIPE_COUNTRY_CODES } from '@/lib/shippingCountryCodes';
import { getFreeShippingConfig } from '@/lib/freeShipping';

export async function POST(req: NextRequest) {
  // Garde-fou global : toute erreur inattendue (produit introuvable, panier obsolète, erreur base de
  // données, erreur Stripe...) doit renvoyer un JSON exploitable côté client plutôt qu'une réponse
  // vide — sinon le navigateur plante sur res.json() avec "Unexpected end of JSON input" et le client
  // ne voit aucun message clair.
  try {
    const { items, shippingOptionId, promoCode, customer } = await req.json();

    // Client banni (voir /admin/bannis) : aucune commande possible, quel que soit l'e-mail saisi.
    const banned = await checkBanForRequest(req, {
      email: customer?.email,
      phone: customer?.phone,
      addressLine1: customer?.addressLine1,
      addressZip: customer?.addressZip,
      moreAddresses: customer?.shipDifferent ? [{ line1: customer?.shipAddressLine1, zip: customer?.shipAddressZip }] : [],
    });
    if (banned) return banResponse();

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Panier vide' }, { status: 400 });
    }

    // Recalcul des prix côté serveur (ne jamais faire confiance au panier client) — fait AVANT le calcul
    // du tarif de livraison, car le seuil de livraison gratuite dépend du sous-total réel.
    const productIds = items.map((i: { productId: string }) => i.productId);
    const products = await prisma.product.findMany({ where: { id: { in: productIds } } });

    const orderItemsData = items.map((item: { productId: string; quantity: number }) => {
      const product = products.find((p: { id: string }) => p.id === item.productId);
      if (!product) throw new Error(`Produit introuvable (il a peut-être été retiré du catalogue) : ${item.productId}`);
      return { product, quantity: item.quantity };
    });

    const subtotal = orderItemsData.reduce(
      (sum: number, i: { product: { price: unknown }; quantity: number }) => sum + Number(i.product.price) * i.quantity,
      0
    );

    const shippingOption = shippingOptionId
      ? await prisma.shippingOption.findUnique({ where: { id: shippingOptionId } })
      : null;
    // Recalcul du tarif de livraison côté serveur selon le code postal réel (jamais celui affiché côté
    // client) — voir src/lib/shippingZones.ts. Le code postal utilisé est celui de l'adresse de
    // livraison si elle diffère de la facturation, sinon celui de facturation, exactement comme le fait
    // déjà /api/checkout-sumup et /api/checkout-paypal.
    const effectiveZip = customer?.shipDifferent ? customer?.shipAddressZip : customer?.addressZip;
    let shippingCost = 0;
    if (shippingOption) {
      const [zones, rates, optionZoneLinks, freeShippingConfig] = await Promise.all([
        prisma.shippingZone.findMany(),
        prisma.shippingZoneRate.findMany({ where: { shippingOptionId: shippingOption.id } }),
        prisma.shippingOptionZone.findMany({ where: { shippingOptionId: shippingOption.id } }),
        getFreeShippingConfig(),
      ]);
      const zoneList = zones.map((z) => ({ id: z.id, name: z.name, postalPrefixes: z.postalPrefixes }));
      const zone = findShippingZone(zoneList, effectiveZip);
      const eligible = isShippingOptionAvailable(
        { id: shippingOption.id, availableMetropole: shippingOption.availableMetropole },
        zone,
        optionZoneLinks.map((l) => ({ shippingOptionId: l.shippingOptionId, zoneId: l.zoneId }))
      );
      if (!eligible) {
        return NextResponse.json({ error: 'Cette option de livraison n’est pas disponible pour cette destination.' }, { status: 400 });
      }
      const resolved = resolveShippingPrice(
        { id: shippingOption.id, price: Number(shippingOption.price) },
        zoneList,
        rates.map((r) => ({ shippingOptionId: r.shippingOptionId, zoneId: r.zoneId, price: Number(r.price) })),
        effectiveZip,
        { config: freeShippingConfig, subtotal }
      );
      shippingCost = resolved.price;
    }

    // Revalidation du code promo côté serveur — ne jamais faire confiance à la réduction affichée côté client
    let discountAmount = 0;
    let appliedPromoCode: string | undefined;
    let stripeCouponId: string | undefined;
    // Compte connecté (si présent) + adresse IP : utilisés par les codes limités à 1 usage par client
    // (ex. REPARMONPHONEFIDELITY) et pour rattacher la commande au compte.
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const clientIp = getClientIp(req);
    if (promoCode) {
      const validation = await validatePromoCode(promoCode, subtotal, {
        email: customer?.email || user?.email || null,
        userId: user?.id ?? null,
        ip: clientIp,
        items: items.map((i: { productId: string; quantity: number }) => ({ productId: i.productId, quantity: i.quantity })),
      });
      // Code refusé : on le dit au client au lieu de facturer sans la remise qu'il voit dans son panier.
      if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 });
      if (validation.ok) {
        discountAmount = validation.discount;
        appliedPromoCode = validation.code;
        // Stripe n'accepte pas de ligne à montant négatif : on passe par un coupon Stripe généré à la volée
        const promo = await prisma.promoCode.findUnique({ where: { code: validation.code } });
        const coupon = await stripe.coupons.create(
          promo?.type === 'PERCENT' && !promo.nonCumulable
            ? { percent_off: Number(promo.value), duration: 'once' }
            : { amount_off: Math.round(discountAmount * 100), currency: 'eur', duration: 'once' }
        );
        stripeCouponId = coupon.id;
      }
    }

    const total = Math.max(0, subtotal + shippingCost - discountAmount);


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
        shippingMethod: shippingOption?.label ?? null,
        promoCode: appliedPromoCode,
        ipAddress: clientIp,
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
      shipping_address_collection: { allowed_countries: ['FR', ...DOMTOM_STRIPE_COUNTRY_CODES] },
      billing_address_collection: 'required',
      customer_email: user?.email ?? undefined,
      metadata: { orderId: order.id },
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/panier`,
    });

    // On mémorise l'id de session Stripe sur la commande pour la retrouver depuis le webhook.
    await prisma.order.update({ where: { id: order.id }, data: { stripeSessionId: session.id } });

    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error('Erreur inattendue lors de la création du paiement Stripe', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Une erreur inattendue est survenue. Réessaie ou contacte-nous.' },
      { status: 500 }
    );
  }
}
