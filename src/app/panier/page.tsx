import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getFreeShippingConfig } from '@/lib/freeShipping';
import AccountBenefits from '@/components/AccountBenefits';
import CartRecap from '@/components/CartRecap';
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

  // Un compte est obligatoire pour commander — on récupère ensuite ses infos pour pré-remplir le paiement.
  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 sm:py-16 text-center">
        <div className="text-5xl mb-4">🛒</div>
        <h1 className="text-2xl font-bold mb-2">Plus qu&apos;une étape avant ta commande</h1>
        <p className="text-gray-600 mb-6">
          Pour commander, on te demande de créer un compte : ça prend moins d&apos;une minute, c&apos;est gratuit, et
          c&apos;est ce qui nous permet de bien suivre ta commande et de t&apos;aider si besoin. Si tu as déjà un
          compte, connecte-toi simplement.
        </p>

        <CartRecap className="mb-4" />
        <AccountBenefits className="mb-6" />

        <div className="flex flex-col gap-3 max-w-xs mx-auto">
          <Link href="/compte/inscription?redirect=/panier" className="bg-brand text-white py-3 rounded-lg font-semibold hover:bg-brand-dark transition">
            Créer mon compte et finaliser
          </Link>
          <Link href="/compte/connexion?redirect=/panier" className="border border-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-50 transition">
            J&apos;ai déjà un compte
          </Link>
        </div>

        <p className="text-xs text-gray-500 mt-5">
          Une question avant de commander ? Appelle-nous au{' '}
          <a href="tel:+33783497262" className="text-brand font-medium hover:underline whitespace-nowrap">07 83 49 72 62</a>{' '}
          (lun–sam, 9h–18h) ou{' '}
          <Link href="/contact" className="text-brand font-medium hover:underline">écris-nous</Link>.
        </p>
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
      freeShipping={freeShipping}
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
