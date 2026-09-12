'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import { useSearchParams } from 'next/navigation';
import { useCart } from '@/store/cart';

// Merchant Center (intégration "Google Avis clients") — identifiant du compte marchand utilisé pour
// vendre les produits sur Google Shopping. Stable et non sensible (déjà visible publiquement dans les
// résultats Google Shopping), donc pas besoin d'env var.
const GOOGLE_MERCHANT_ID = 5610235067;

// Snippet officiel Google Avis clients : affiche, une fois la commande confirmée, une proposition
// d'enquête de satisfaction au client. Uniquement rendu si on a pu retrouver la commande (paiement
// Stripe ou SumUp — PayPal ne renvoie pas encore d'identifiant ici, voir /api/checkout/success-info).
function GoogleCustomerReviewsOptIn({ orderId, email, createdAt }: { orderId: string; email: string; createdAt: string }) {
  // Estimation simple : date de commande + 2 jours (préparation + Chronopost 24h). Le pays de
  // livraison n'est pas encore disponible ici (adresse gérée ailleurs dans le tunnel de commande) —
  // "FR" par défaut, correct pour l'immense majorité des commandes (France métropolitaine/DOM-TOM).
  const estimated = new Date(createdAt);
  estimated.setDate(estimated.getDate() + 2);
  const estimatedDeliveryDate = estimated.toISOString().slice(0, 10);

  return (
    <>
      <Script src="https://apis.google.com/js/platform.js?onload=renderOptIn" strategy="afterInteractive" async />
      <Script id="google-customer-reviews-optin" strategy="afterInteractive">
        {`
          window.renderOptIn = function() {
            window.gapi.load('surveyoptin', function() {
              window.gapi.surveyoptin.render({
                "merchant_id": ${GOOGLE_MERCHANT_ID},
                "order_id": ${JSON.stringify(orderId)},
                "email": ${JSON.stringify(email)},
                "delivery_country": "FR",
                "estimated_delivery_date": ${JSON.stringify(estimatedDeliveryDate)}
              });
            });
          };
        `}
      </Script>
    </>
  );
}

function CheckoutSuccessContent() {
  const clear = useCart((s) => s.clear);
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id'); // Stripe
  const orderId = searchParams.get('order_id'); // SumUp
  const [orderInfo, setOrderInfo] = useState<{ orderId: string; email: string; createdAt: string } | null>(null);

  useEffect(() => {
    clear();
  }, [clear]);

  useEffect(() => {
    if (!sessionId && !orderId) return;
    const qs = sessionId ? `session_id=${encodeURIComponent(sessionId)}` : `order_id=${encodeURIComponent(orderId!)}`;
    fetch(`/api/checkout/success-info?${qs}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.orderId) setOrderInfo(data);
      })
      .catch(() => {});
  }, [sessionId, orderId]);

  return (
    <div className="max-w-xl mx-auto px-4 py-20 text-center">
      <div className="text-5xl mb-4">✅</div>
      <h1 className="text-2xl font-bold mb-2">Merci pour votre commande !</h1>
      <p className="text-gray-600 mb-8">
        Votre paiement a bien été confirmé. Vous allez recevoir un e-mail de confirmation avec le suivi Chronopost.
      </p>
      <Link href="/boutique" className="bg-brand text-white px-6 py-3 rounded-lg font-semibold hover:bg-brand-dark transition">
        Retour à la boutique
      </Link>
      {orderInfo && <GoogleCustomerReviewsOptIn {...orderInfo} />}
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={null}>
      <CheckoutSuccessContent />
    </Suspense>
  );
}
