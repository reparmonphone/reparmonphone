'use client';

import { useState, useTransition } from 'react';
import { setFreeShippingSettings } from './actions';

export default function FreeShippingSettings({
  initialEnabled,
  initialThreshold,
}: {
  initialEnabled: boolean;
  initialThreshold: number;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [threshold, setThreshold] = useState(initialThreshold);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty = enabled !== initialEnabled || threshold !== initialThreshold;

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const r = await setFreeShippingSettings({ enabled, threshold });
      if (r.error) setError(r.error);
      else setSaved(true);
    });
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5">
      <h2 className="font-semibold mb-1">Livraison gratuite</h2>
      <p className="text-xs text-gray-400 mb-4">
        Offre les frais de port en France métropolitaine à partir d&apos;un montant de commande. Appliquée
        automatiquement au panier et au paiement — n&apos;affecte jamais l&apos;Outre-mer ni la Corse.
      </p>

      <label className="flex items-center gap-2 text-sm mb-4 cursor-pointer">
        <input type="checkbox" checked={enabled} onChange={(e) => { setEnabled(e.target.checked); setSaved(false); }} />
        Activer la livraison gratuite
      </label>

      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm text-gray-600">À partir de</span>
        <input
          type="number"
          step="1"
          min="0"
          value={threshold}
          onChange={(e) => { setThreshold(parseFloat(e.target.value) || 0); setSaved(false); }}
          disabled={!enabled}
          className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400"
        />
        <span className="text-sm text-gray-600">€ d&apos;achat</span>
      </div>

      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
      {saved && !dirty && <p className="text-green-600 text-sm mb-3">✅ Enregistré.</p>}

      <button
        onClick={save}
        disabled={pending || !dirty}
        className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-dark transition disabled:opacity-50"
      >
        {pending ? 'Enregistrement...' : 'Enregistrer'}
      </button>
    </div>
  );
}
