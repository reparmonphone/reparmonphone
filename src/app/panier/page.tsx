import { prisma } from '@/lib/prisma';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getFreeShippingConfig } from '@/lib/freeShipping';
import PanierClient from './PanierClient';

export default async function PanierPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [shippingOptions, shippingZones, shippingZoneRates, shippingOptionZoneLinks, freeShipping] = await Promise.all([
    prisma.shippingOption.findMany({ where: { active: true }, orderBy: { order: 'asc' } }),
    prisma.shippingZone.findMany({ orderBy: { order: 'asc' } }),
    prisma.shippingZoneRate.findMany(),
    prisma.shippingOptionZone.findMany(),
    getFreeShippingConfig(),
  ]);

  const paymentSettings = await prisma.siteSetting.findMany({
    where: { key: { in: ['payment_stripe_enabled', 'payment_sumup_enabled', 'payment_paypal_enabled'] } },
  });
  const isEnabled = (key: string) => paymentSettings.find((s) => s.key === key)?.value !== 'false';

  // Commande SANS compte autorisée : les routes de paiement (/api/checkout, /api/checkout-sumup,
  // /api/checkout-paypal) créent déjà des commandes "invité" (userId vide). Si le client est connecté on
  // pré-remplit ses coordonnées, sinon le formulaire démarre vide.
  const isGuest = !user;
  const meta = user?.user_metadata ?? {};

  return (
    <PanierClient
      shippingOptions={shippingOptions.map((o) => ({
        id: o.id,
        label: o.label,
        description: o.description,
        price: Number(o.price),
        availableMetropole: o.availableMetropole,
      }))}
      shippingZones={shippingZones.map((z) => ({ id: z.id, name: z.name, postalPrefixes: z.postalPrefixes }))}
      shippingZoneRates={shippingZoneRates.map((r) => ({
        shippingOptionId: r.shippingOptionId,
        zoneId: r.zoneId,
        price: Number(r.price),
      }))}
      shippingOptionZoneLinks={shippingOptionZoneLinks.map((l) => ({
        shippingOptionId: l.shippingOptionId,
        zoneId: l.zoneId,
      }))}
      freeShipping={freeShipping}
      isGuest={isGuest}
      paymentMethods={{
        stripe: isEnabled('payment_stripe_enabled'),
        sumup: isEnabled('payment_sumup_enabled'),
        paypal: isEnabled('payment_paypal_enabled'),
      }}
      initialCustomer={{
        name: [meta.first_name, meta.last_name].filter(Boolean).join(' ') || '',
        email: user?.email ?? '',
        phone: meta.phone ?? '',
        addressLine1: meta.address_line1 ?? '',
        addressZip: meta.address_zip ?? '',
        addressCity: meta.address_city ?? '',
      }}
    />
  );
}
