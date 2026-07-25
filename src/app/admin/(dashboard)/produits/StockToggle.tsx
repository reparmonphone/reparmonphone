'use client';

import { useTransition } from 'react';
import { toggleStock } from './actions';

export default function StockToggle({ productId, inStock }: { productId: string; inStock: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      disabled={pending}
      onClick={() => startTransition(() => toggleStock(productId, !inStock))}
      className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${
        inStock ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200'
      } disabled:opacity-50`}
    >
      {inStock ? 'En stock' : 'Rupture'}
    </button>
  );
}
