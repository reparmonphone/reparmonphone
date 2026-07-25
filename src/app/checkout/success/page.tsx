'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useCart } from '@/store/cart';

export default function CheckoutSuccessPage() {
  const clear = useCart((s) => s.clear);

  useEffect(() => {
    clear();
  }, [clear]);

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
    </div>
  );
}
