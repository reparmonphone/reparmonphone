'use client';

import { useState, useTransition } from 'react';
import { applyAllPendingPriceDecreases, ignoreAllPendingPriceDecreases } from './actions';

export default function BulkPriceDecreaseActions({ count }: { count: number }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (count === 0) return null;

  function handleApplyAll() {
    if (
      !confirm(
        `Appliquer la baisse de prix fournisseur sur les ${count} ligne(s) en attente ?\n\nSi un même produit apparaît plusieurs fois dans la file (doublons), seule la ligne la plus récente sera appliquée — les autres seront simplement retirées sans changer le prix.`
      )
    )
      return;
    setError(null);
    setResult(null);
    startTransition(async () => {
      const r = await applyAllPendingPriceDecreases();
      if ('error' in r) {
        setError(r.error);
      } else {
        setResult(
          `✅ ${r.applied} produit(s) mis à jour${r.duplicatesCleaned ? ` · ${r.duplicatesCleaned} ligne(s) en double nettoyée(s) sans changement de prix` : ''}.`
        );
      }
    });
  }

  function handleIgnoreAll() {
    if (!confirm(`Ignorer les ${count} ligne(s) en attente et garder tes prix actuels sur tous ces produits ?`)) return;
    setError(null);
    setResult(null);
    startTransition(async () => {
      const r = await ignoreAllPendingPriceDecreases();
      if ('error' in r) {
        setError(r.error);
      } else {
        setResult(`${r.count} ligne(s) ignorée(s), prix inchangés.`);
      }
    });
  }

  return (
    <div className="mb-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={handleApplyAll}
          disabled={pending}
          className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-dark transition disabled:opacity-60"
        >
          {pending ? 'Traitement en cours...' : `✅ Tout appliquer (${count})`}
        </button>
        <button
          onClick={handleIgnoreAll}
          disabled={pending}
          className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition disabled:opacity-60"
        >
          Tout ignorer (garder mes prix)
        </button>
      </div>
      {result && <p className="text-sm text-green-700 mt-2">{result}</p>}
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      <p className="text-xs text-gray-400 mt-1">
        En cas de doublons (même produit apparu plusieurs fois dans la file), seule la ligne la plus récente est appliquée — les anciennes sont simplement retirées de la liste sans changer le prix.
      </p>
    </div>
  );
}
