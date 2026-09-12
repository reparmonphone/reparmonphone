'use client';

import { useTransition } from 'react';
import { applyPriceDecrease, ignorePriceDecrease } from './actions';

export default function PriceDecreaseRow({
  itemId,
  title,
  oldPrice,
  oldSupplierPrice,
  newSupplierPrice,
}: {
  itemId: string;
  title: string;
  oldPrice: number;
  oldSupplierPrice: number;
  newSupplierPrice: number;
}) {
  const [isPending, startTransition] = useTransition();
  const delta = newSupplierPrice - oldSupplierPrice; // négatif
  const suggestedPrice = Math.round((oldPrice + delta) * 100) / 100;

  function handleApply() {
    startTransition(async () => {
      await applyPriceDecrease(itemId);
    });
  }
  function handleIgnore() {
    startTransition(async () => {
      await ignorePriceDecrease(itemId);
    });
  }

  return (
    <tr className="hover:bg-gray-50 align-top">
      <td className="px-4 py-3 font-medium text-gray-800 max-w-[280px]">{title}</td>
      <td className="px-4 py-3 whitespace-nowrap text-gray-500">
        {oldSupplierPrice.toFixed(2)}€ → <span className="text-green-700 font-medium">{newSupplierPrice.toFixed(2)}€</span>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">{oldPrice.toFixed(2)}€</td>
      <td className="px-4 py-3 whitespace-nowrap text-green-700 font-medium">{suggestedPrice.toFixed(2)}€</td>
      <td className="px-4 py-3 text-right whitespace-nowrap">
        <div className="flex gap-2 justify-end">
          <button
            onClick={handleApply}
            disabled={isPending}
            className="bg-brand text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-brand-dark transition disabled:opacity-60"
          >
            Appliquer la baisse
          </button>
          <button
            onClick={handleIgnore}
            disabled={isPending}
            className="border border-gray-300 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-50 transition disabled:opacity-60"
          >
            Garder mon prix
          </button>
        </div>
      </td>
    </tr>
  );
}
