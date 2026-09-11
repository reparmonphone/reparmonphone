import { prisma } from '@/lib/prisma';
import PaymentMethodToggle from './PaymentMethodToggle';
import FeeRateInput from './FeeRateInput';

export default async function AdminPaiementsPage() {
  const settings = await prisma.siteSetting.findMany({
    where: {
      key: {
        in: [
          'payment_stripe_enabled',
          'payment_sumup_enabled',
          'payment_paypal_enabled',
          'fee_rate_stripe',
          'fee_rate_sumup',
          'fee_rate_paypal',
        ],
      },
    },
  });
  const isEnabled = (key: string) => settings.find((s) => s.key === key)?.value !== 'false'; // activé par défaut
  const feeRate = (provider: string) => settings.find((s) => s.key === `fee_rate_${provider}`)?.value ?? '0';

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

      <div className="bg-white border border-gray-100 rounded-xl p-5 mt-6">
        <h2 className="font-semibold text-gray-800 mb-1">Frais de commission</h2>
        <p className="text-sm text-gray-500 mb-3">
          Pourcentage prélevé par chaque plateforme sur le montant de la commande. Utilisé uniquement pour
          calculer le bénéfice réel (page &quot;Bénéfice&quot;) — n&apos;affecte jamais le prix payé par le client.
        </p>
        <div className="divide-y divide-gray-100">
          <FeeRateInput provider="stripe" label="Stripe" rate={feeRate('stripe')} />
          <FeeRateInput provider="sumup" label="SumUp" rate={feeRate('sumup')} />
          <FeeRateInput provider="paypal" label="PayPal" rate={feeRate('paypal')} />
        </div>
      </div>
    </div>
  );
}
