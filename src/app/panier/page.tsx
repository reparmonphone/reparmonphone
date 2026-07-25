'use client';

import Image from 'next/image';
import { useState } from 'react';
import { useCart } from '@/store/cart';
import { formatPrice } from '@/lib/format';

export default function PanierPage() {
  const { items, removeItem, setQuantity, totalPrice } = useCart();
  const [loading, setLoading] = useState(false);

  async function checkout() {
    setLoading(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setLoading(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-500 text-lg">Votre panier est vide.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-6">Votre panier</h1>

      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.productId} className="flex items-center gap-4 bg-white rounded-xl border border-gray-100 p-4">
            <div className="relative w-16 h-16 shrink-0 bg-gray-50 rounded">
              {item.imageUrl && <Image src={item.imageUrl} alt={item.title} fill className="object-contain p-1" />}
            </div>
            <div className="flex-1">
              <p className="font-medium text-sm">{item.title}</p>
              <p className="text-brand-dark font-semibold">{formatPrice(item.price)}</p>
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

      <div className="mt-8 flex items-center justify-between border-t border-gray-200 pt-6">
        <span className="text-lg font-bold">Total</span>
        <span className="text-2xl font-extrabold text-brand-dark">{formatPrice(totalPrice())}</span>
      </div>

      <button
        onClick={checkout}
        disabled={loading}
        className="mt-6 w-full bg-brand text-white py-3 rounded-lg font-semibold hover:bg-brand-dark transition disabled:opacity-60"
      >
        {loading ? 'Redirection...' : 'Passer au paiement'}
      </button>
    </div>
  );
}
