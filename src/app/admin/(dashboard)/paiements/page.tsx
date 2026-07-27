import { prisma } from '@/lib/prisma';
import PaymentMethodToggle from './PaymentMethodToggle';

export default async function AdminPaiementsPage() {
  const settings = await prisma.siteSetting.findMany({
    where: { key: { in: ['payment_stripe_enabled', 'payment_sumup_enabled', 'payment_paypal_enabled'] } },
  });
  const isEnabled = (key: string) => settings.find((s) => s.key === key)?.value !== 'false'; // activé par défaut

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold mb-1">Moyens de paiement</h1>
      <p className="text-gray-500 mb-6">
        Active ou désactive les moyens de paiement proposés sur la page panier. Un moyen désactivé disparaît
        immédiatement du site, sans toucher à sa configuration (clés API, etc.).
      </p>

      <div className="space-y-3">
        <PaymentMethodToggle provider="stripe" label="Stripe" description="Carte bancaire (+ Apple Pay / Google Pay automatiques)" enabled={isEnabled('payment_stripe_enabled')} />
        <PaymentMethodToggle provider="sumup" label="SumUp" description="Carte bancaire" enabled={isEnabled('payment_sumup_enabled')} />
        <PaymentMethodToggle provider="paypal" label="PayPal" description="Compte PayPal ou carte via PayPal" enabled={isEnabled('payment_paypal_enabled')} />
      </div>
    </div>
  );
}
