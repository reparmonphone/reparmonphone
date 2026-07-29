'use client';

import { useState, useTransition } from 'react';
import { updateProductPrice } from './actions';
import { formatPrice } from '@/lib/format';

export default function PriceEditable({ productId, price }: { productId: string; price: number }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(price.toString());
  const [currentPrice, setCurrentPrice] = useState(price);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function startEditing() {
    setValue(currentPrice.toString());
    setError(null);
    setEditing(true);
  }

  function save() {
    const parsed = Number(value.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError('Prix invalide');
      return;
    }
    startTransition(async () => {
      const result = await updateProductPrice(productId, parsed);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setCurrentPrice(parsed);
      setEditing(false);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      save();
    } else if (e.key === 'Escape') {
      setEditing(false);
      setError(null);
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={startEditing}
        className="text-left hover:bg-gray-100 px-2 py-1 -mx-2 -my-1 rounded transition"
        title="Cliquer pour modifier le prix"
      >
        {formatPrice(currentPrice)}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <input
        type="text"
        inputMode="decimal"
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={save}
        disabled={pending}
        className="w-20 border border-brand rounded px-1.5 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand disabled:opacity-60"
      />
      <span className="text-xs text-gray-400">€</span>
      {error && <span className="text-red-600 text-xs">{error}</span>}
    </div>
  );
}
