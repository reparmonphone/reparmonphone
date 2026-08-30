import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import PanierClient from './PanierClient';

export default async function PanierPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [shippingOptions, shippingZones, shippingZoneRates, shippingOptionZoneLinks] = await Promise.all([
    prisma.shippingOption.findMany({ where: { active: true }, orderBy: { order: 'asc' } }),
    prisma.shippingZone.findMany({ orderBy: { order: 'asc' } }),
    prisma.shippingZoneRate.findMany(),
    prisma.shippingOptionZone.findMany(),
  ]);

  const paymentSettings = await prisma.siteSetting.findMany({
    where: { key: { in: ['payment_stripe_enabled', 'payment_sumup_enabled', 'payment_paypal_enabled'] } },
  });
  const isEnabled = (key: string) => paymentSettings.find((s) => s.key === key)?.value !== 'false';

  // Un compte est obligatoire pour commander — on récupère ensuite ses infos pour pré-remplir le paiement.
  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <div className="text-5xl mb-4">🔒</div>
        <h1 className="text-2xl font-bold mb-2">Un compte est nécessaire pour commander</h1>
        <p className="text-gray-500 mb-8">
          Crée un compte (ou connecte-toi) pour passer commande — ça te permet aussi de suivre tes commandes et
          d&apos;être recontacté plus facilement en cas de besoin.
        </p>
        <div className="flex flex-col gap-3 max-w-xs mx-auto">
          <Link href="/compte/inscription?redirect=/panier" className="bg-brand text-white py-3 rounded-lg font-semibold hover:bg-brand-dark transition">
            Créer un compte
          </Link>
          <Link href="/compte/connexion?redirect=/panier" className="border border-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-50 transition">
            J&apos;ai déjà un compte
          </Link>
        </div>
      </div>
    );
  }

  const meta = user.user_metadata ?? {};

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
      paymentMethods={{
        stripe: isEnabled('payment_stripe_enabled'),
        sumup: isEnabled('payment_sumup_enabled'),
        paypal: isEnabled('payment_paypal_enabled'),
      }}
      initialCustomer={{
        name: [meta.first_name, meta.last_name].filter(Boolean).join(' ') || '',
        email: user.email ?? '',
        phone: meta.phone ?? '',
        addressLine1: meta.address_line1 ?? '',
        addressZip: meta.address_zip ?? '',
        addressCity: meta.address_city ?? '',
      }}
    />
  );
}
