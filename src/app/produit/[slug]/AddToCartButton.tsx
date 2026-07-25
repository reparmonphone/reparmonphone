'use client';

import { useState } from 'react';
import { useCart } from '@/store/cart';

export default function AddToCartButton({
  product,
  disabled,
}: {
  product: { productId: string; slug: string; title: string; price: number; imageUrl: string | null };
  disabled?: boolean;
}) {
  const addItem = useCart((s) => s.addItem);
  const [added, setAdded] = useState(false);

  return (
    <button
      disabled={disabled}
      onClick={() => {
        addItem(product);
        setAdded(true);
        setTimeout(() => setAdded(false), 1500);
      }}
      className="w-full md:w-auto bg-brand text-white px-8 py-3 rounded-lg font-semibold hover:bg-brand-dark transition disabled:bg-gray-300 disabled:cursor-not-allowed"
    >
      {disabled ? 'Indisponible' : added ? '✅ Ajouté au panier' : '🛒 Ajouter au panier'}
    </button>
  );
}
