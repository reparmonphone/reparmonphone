'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { useCart } from '@/store/cart';
import { formatPrice } from '@/lib/format';
import TrustBadges from '@/components/TrustBadges';

type ShippingOption = { id: string; label: string; description: string | null; price: number };
type InitialCustomer = {
  name: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressZip: string;
  addressCity: string;
};
type PaymentMethods = { stripe: boolean; sumup: boolean; paypal: boolean };

export default function PanierClient({
  shippingOptions,
  paymentMethods,
  initialCustomer,
}: {
  shippingOptions: ShippingOption[];
  paymentMethods: PaymentMethods;
  initialCustomer: InitialCustomer;
}) {
  const { items, removeItem, setQuantity, totalPrice } = useCart();
  const [loading, setLoading] = useState<'stripe' | 'sumup' | 'paypal' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shippingId, setShippingId] = useState(shippingOptions[0]?.id ?? '');
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // Adresse de facturation (formulaire principal)
  const [name, setName] = useState(initialCustomer.name);
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState(initialCustomer.email);
  const [phone, setPhone] = useState(initialCustomer.phone);
  const [addressLine1, setAddressLine1] = useState(initialCustomer.addressLine1);
  const [addressZip, setAddressZip] = useState(initialCustomer.addressZip);
  const [addressCity, setAddressCity] = useState(initialCustomer.addressCity);

  // Adresse de livraison, seulement si différente de la facturation
  const [shipDifferent, setShipDifferent] = useState(false);
  const [shipName, setShipName] = useState('');
  const [shipAddressLine1, setShipAddressLine1] = useState('');
  const [shipAddressZip, setShipAddressZip] = useState('');
  const [shipAddressCity, setShipAddressCity] = useState('');

  // Code promo
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; discount: number } | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [checkingPromo, setCheckingPromo] = useState(false);

  const shipping = shippingOptions.find((s) => s.id === shippingId);
  const shippingCost = shipping?.price ?? 0;
  const subtotal = totalPrice();
  const discount = appliedPromo?.discount ?? 0;
  const total = Math.max(0, subtotal + shippingCost - discount);

  async function applyPromoCode() {
    if (!promoInput.trim()) return;
    setCheckingPromo(true);
    setPromoError(null);
    try {
      const res = await fetch('/api/promo/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: promoInput, subtotal }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPromoError(data.error ?? 'Code invalide.');
        setAppliedPromo(null);
        return;
      }
      setAppliedPromo({ code: data.code, discount: data.discount });
    } finally {
      setCheckingPromo(false);
    }
  }

  function removePromoCode() {
    setAppliedPromo(null);
    setPromoInput('');
    setPromoError(null);
  }

  function billingValid() {
    return name.trim() && email.trim() && phone.trim() && addressLine1.trim() && addressZip.trim() && addressCity.trim();
  }
  function shippingValid() {
    if (!shipDifferent) return true;
    return shipName.trim() && shipAddressLine1.trim() && shipAddressZip.trim() && shipAddressCity.trim();
  }

  async function checkout(provider: 'stripe' | 'sumup' | 'paypal') {
    if (!acceptedTerms) {
      setError('Merci d\u2019accepter les conditions générales avant de payer.');
      return;
    }
    if (provider !== 'stripe' && (!billingValid() || !shippingValid())) {
      setError('Merci de remplir tes coordonnées et ton adresse avant de payer.');
      return;
    }

    setLoading(provider);
    setError(null);
    const endpoint = provider === 'stripe' ? '/api/checkout' : provider === 'sumup' ? '/api/checkout-sumup' : '/api/checkout-paypal';

    const customer = {
      name,
      company,
      email,
      phone,
      addressLine1,
      addressZip,
      addressCity,
      shipDifferent,
      shipName,
      shipAddressLine1,
      shipAddressZip,
      shipAddressCity,
    };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, shippingOptionId: shippingId, customer, promoCode: appliedPromo?.code }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setError(data.error ?? 'Erreur lors de la création du paiement.');
    } finally {
      setLoading(null);
    }
  }

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-500 text-lg">Ton panier est vide.</p>
        <Link href="/boutique" className="text-brand font-medium hover:underline mt-3 inline-block">
          Retour à la boutique
        </Link>
      </div>
    );
  }

  const noPaymentMethodEnabled = !paymentMethods.stripe && !paymentMethods.sumup && !paymentMethods.paypal;

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-center gap-3 mb-8 text-sm">
        <StepBadge n={1} label="Panier" active />
        <span className="text-gray-300">›</span>
        <StepBadge n={2} label="Vérifier" active />
        <span className="text-gray-300">›</span>
        <StepBadge n={3} label="Statut de la commande" />
      </div>

      <div className="bg-brand text-white rounded-xl px-5 py-3 mb-8 text-sm">
        🗓️ 👉{' '}
        <Link href="/rdv" className="underline font-medium">
          Pense à prendre rendez-vous
        </Link>{' '}
        si tu as opté pour une réparation à domicile ou en atelier (minimum 24h après, suivant disponibilités).
      </div>

      <div className="grid lg:grid-cols-[1fr_380px] gap-10">
        {/* Colonne gauche */}
        <div>
          <h2 className="text-lg font-bold mb-1">Adresse de facturation</h2>
          <p className="text-xs text-gray-400 mb-4">Pré-remplie depuis ton compte — modifie si besoin.</p>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom complet *" className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm" />
            <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Nom de l'entreprise (facultatif)" className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email *" className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm" />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Téléphone *" className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm" />
          </div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <input value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} placeholder="Numéro et nom de rue *" className="col-span-2 border border-gray-200 rounded-lg px-3 py-2.5 text-sm" />
            <input value={addressZip} onChange={(e) => setAddressZip(e.target.value)} placeholder="Code postal *" className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm" />
          </div>
          <input value={addressCity} onChange={(e) => setAddressCity(e.target.value)} placeholder="Ville *" className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm mb-4" />

          <label className="flex items-center gap-2 text-sm mb-6 cursor-pointer">
            <input type="checkbox" checked={shipDifferent} onChange={(e) => setShipDifferent(e.target.checked)} />
            Envoyer à une adresse différente ?
          </label>

          {shipDifferent && (
            <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
              <h3 className="font-semibold text-sm mb-3">Adresse de livraison</h3>
              <input value={shipName} onChange={(e) => setShipName(e.target.value)} placeholder="Nom complet du destinataire *" className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm mb-3" />
              <div className="grid grid-cols-3 gap-3 mb-3">
                <input value={shipAddressLine1} onChange={(e) => setShipAddressLine1(e.target.value)} placeholder="Numéro et nom de rue *" className="col-span-2 border border-gray-200 rounded-lg px-3 py-2.5 text-sm" />
                <input value={shipAddressZip} onChange={(e) => setShipAddressZip(e.target.value)} placeholder="Code postal *" className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm" />
              </div>
              <input value={shipAddressCity} onChange={(e) => setShipAddressCity(e.target.value)} placeholder="Ville *" className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm" />
            </div>
          )}

          <h2 className="text-lg font-bold mb-4">Articles</h2>
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.productId} className="flex items-center gap-4 bg-white rounded-xl border border-gray-100 p-4">
                <div className="relative w-14 h-14 shrink-0 bg-gray-50 rounded">
                  {item.imageUrl && <Image src={item.imageUrl} alt={item.title} fill className="object-contain p-1" />}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{item.title}</p>
                  <p className="text-brand-dark font-semibold text-sm">{formatPrice(item.price)}</p>
                </div>
                <input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(e) => setQuantity(item.productId, Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-center"
                />
                <button onClick={() => removeItem(item.productId)} className="text-gray-400 hover:text-red-500 text-sm">
                  Retirer
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Colonne droite */}
        <div className="bg-white border border-gray-100 rounded-xl p-6 h-fit lg:sticky lg:top-6">
          <h2 className="font-bold text-lg mb-4">Ta commande</h2>

          <div className="space-y-2 mb-4 pb-4 border-b border-gray-100">
            {items.map((item) => (
              <div key={item.productId} className="flex justify-between text-sm">
                <span className="text-gray-600">{item.quantity} × {item.title}</span>
                <span className="font-medium">{formatPrice(item.price * item.quantity)}</span>
              </div>
            ))}
          </div>

          <div className="flex justify-between text-sm mb-4">
            <span className="text-gray-600">Sous-total</span>
            <span className="font-medium">{formatPrice(totalPrice())}</span>
          </div>

          <div className="mb-4 pb-4 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-700 mb-2">Code promo</p>
            {appliedPromo ? (
              <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm">
                <span className="text-green-700 font-medium">✅ {appliedPromo.code} appliqué</span>
                <button onClick={removePromoCode} className="text-gray-400 hover:text-red-500 text-xs">Retirer</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  value={promoInput}
                  onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                  placeholder="Ex: ETE2026"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm uppercase"
                />
                <button
                  onClick={applyPromoCode}
                  disabled={checkingPromo || !promoInput.trim()}
                  className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition disabled:opacity-50"
                >
                  {checkingPromo ? '...' : 'Appliquer'}
                </button>
              </div>
            )}
            {promoError && <p className="text-red-600 text-xs mt-1.5">{promoError}</p>}
          </div>

          {shippingOptions.length > 0 && (
            <div className="mb-4 pb-4 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-700 mb-2">Expédition</p>
              <div className="space-y-2">
                {shippingOptions.map((opt) => (
                  <label key={opt.id} className="flex items-start gap-2 text-sm cursor-pointer">
                    <input type="radio" name="shipping" checked={shippingId === opt.id} onChange={() => setShippingId(opt.id)} className="mt-0.5" />
                    <span className="flex-1">
                      {opt.label}
                      {opt.description && <span className="block text-xs text-gray-400">{opt.description}</span>}
                    </span>
                    <span className="font-medium shrink-0">{formatPrice(opt.price)}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {appliedPromo && (
            <div className="flex justify-between text-sm mb-2 text-green-700">
              <span>Réduction ({appliedPromo.code})</span>
              <span className="font-medium">− {formatPrice(discount)}</span>
            </div>
          )}

          <div className="flex justify-between items-center mb-6">
            <span className="text-lg font-bold">Total</span>
            <span className="text-2xl font-extrabold text-brand-dark">{formatPrice(total)}</span>
          </div>

          <p className="text-xs text-gray-500 mb-4 leading-relaxed">
            Tes données personnelles seront utilisées pour traiter ta commande, soutenir ton expérience sur ce
            site et à d&apos;autres fins décrites dans notre{' '}
            <Link href="/confidentialite" className="underline hover:text-brand">politique de confidentialité</Link>.
          </p>

          <div className="bg-brand-light text-brand-dark rounded-lg px-3 py-2.5 text-xs mb-4">
            🗓️ 👉{' '}
            <Link href="/rdv" className="underline font-medium">
              Pense à prendre rendez-vous
            </Link>{' '}
            si tu as opté pour une réparation à domicile ou en atelier (minimum 24h après, suivant disponibilités).
          </div>

          <label className="flex items-start gap-2 text-sm mb-4 cursor-pointer">
            <input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} className="mt-0.5" />
            <span>
              J&apos;ai lu et j&apos;accepte les{' '}
              <Link href="/cgv" target="_blank" className="underline hover:text-brand font-medium">conditions générales</Link> *
            </span>
          </label>

          {noPaymentMethodEnabled ? (
            <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
              Aucun moyen de paiement n&apos;est disponible pour le moment. Contacte-nous directement pour finaliser ta commande.
            </p>
          ) : (
            <div className="space-y-2.5">
              {paymentMethods.stripe && (
                <>
                  <button
                    onClick={() => checkout('stripe')}
                    disabled={loading !== null}
                    className="w-full bg-brand text-white py-3 rounded-lg font-semibold hover:bg-brand-dark transition disabled:opacity-60"
                  >
                    {loading === 'stripe' ? 'Redirection...' : '💳 Payer par carte (Stripe)'}
                  </button>
                  <p className="text-center text-xs text-gray-400">Apple Pay et Google Pay disponibles automatiquement si ton appareil les supporte.</p>
                </>
              )}

              {paymentMethods.sumup && (
                <button
                  onClick={() => checkout('sumup')}
                  disabled={loading !== null}
                  className="w-full bg-[#0BB0D8] text-white py-3 rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-60"
                >
                  {loading === 'sumup' ? 'Redirection...' : '💳 Payer avec SumUp'}
                </button>
              )}

              {paymentMethods.paypal && (
                <button
                  onClick={() => checkout('paypal')}
                  disabled={loading !== null}
                  className="w-full bg-[#FFC439] text-[#003087] py-3 rounded-lg font-bold hover:opacity-90 transition disabled:opacity-60"
                >
                  {loading === 'paypal' ? 'Redirection...' : 'Payer avec PayPal'}
                </button>
              )}
            </div>
          )}

          {error && <p className="text-red-600 text-sm mt-4 text-center">{error}</p>}

          <p className="text-xs text-gray-400 mt-4 text-center">
            Paiement 100% sécurisé. Tes données ne sont jamais stockées sur nos serveurs.
          </p>

          <TrustBadges className="mt-4" />
        </div>
      </div>
    </div>
  );
}

function StepBadge({ n, label, active }: { n: number; label: string; active?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
          active ? 'bg-brand text-white' : 'bg-gray-200 text-gray-500'
        }`}
      >
        {n}
      </span>
      <span className={active ? 'font-semibold text-gray-800' : 'text-gray-400'}>{label.toUpperCase()}</span>
    </div>
  );
}
