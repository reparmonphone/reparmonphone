'use client';

import { useState, useTransition } from 'react';
import { setFeeRate, setFeeFixed } from './actions';

// Frais de la plateforme de paiement = pourcentage + montant fixe par transaction (ex : PayPal
// 2,90 % + 0,35 €). Utilisé uniquement pour calculer le bénéfice sur /admin/benefice.
// N'a aucun effet sur le prix affiché ou facturé au client.
export default function FeeRateInput({
  provider,
  label,
  rate,
  fixed,
}: {
  provider: 'stripe' | 'sumup' | 'paypal';
  label: string;
  rate: string;
  fixed: string;
}) {
  const [value, setValue] = useState(rate);
  const [fixedValue, setFixedValue] = useState(fixed);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function save() {
    startTransition(async () => {
      await Promise.all([setFeeRate(provider, value), setFeeFixed(provider, fixedValue)]);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="text-sm text-gray-600">{label}</span>
      <div className="flex items-center gap-2 shrink-0">
        <input
          type="number"
          step="0.01"
          min="0"
          max="100"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-sm text-right"
        />
        <span className="text-xs text-gray-400">%</span>
        <span className="text-xs text-gray-300">+</span>
        <input
          type="number"
          step="0.01"
          min="0"
          value={fixedValue}
          onChange={(e) => setFixedValue(e.target.value)}
          className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-sm text-right"
        />
        <span className="text-xs text-gray-400">€</span>
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="text-xs bg-gray-800 text-white px-2.5 py-1.5 rounded-lg hover:bg-gray-700 transition disabled:opacity-60"
        >
          {isPending ? '...' : 'OK'}
        </button>
        {saved && <span className="text-green-600 text-xs">✓</span>}
      </div>
    </div>
  );
}
