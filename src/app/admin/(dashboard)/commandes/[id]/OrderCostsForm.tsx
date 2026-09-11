'use client';

import { useState, useTransition } from 'react';
import { updateOrderCosts } from '../actions';

// Coûts réels de la commande, visibles ADMIN UNIQUEMENT (jamais exposés côté client) : prix d'achat
// payé au fournisseur pour chaque article de CETTE commande précise (le prix pro peut varier d'une
// commande à l'autre, d'où une saisie manuelle plutôt qu'un prix par défaut sur la fiche produit), et
// frais de port réellement payés pour l'expédition (différents de ce que le client a payé). Alimente
// le calcul du bénéfice sur /admin/benefice.
export default function OrderCostsForm({
  orderId,
  items,
  actualShippingCost,
}: {
  orderId: string;
  items: { id: string; label: string; quantity: number; costPrice: number | null }[];
  actualShippingCost: number | null;
}) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(items.map((i) => [i.id, i.costPrice != null ? String(i.costPrice) : '']))
  );
  const [shipping, setShipping] = useState(actualShippingCost != null ? String(actualShippingCost) : '');
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function save() {
    startTransition(async () => {
      await updateOrderCosts(orderId, {
        items: items.map((i) => ({
          id: i.id,
          costPrice: values[i.id] === '' ? null : Math.max(0, Number(values[i.id])),
        })),
        actualShippingCost: shipping === '' ? null : Math.max(0, Number(shipping)),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    });
  }

  return (
    <div id="couts" className="bg-white border border-gray-100 rounded-xl p-6 mb-4 scroll-mt-20">
      <h2 className="font-semibold mb-1">Coûts réels (admin uniquement)</h2>
      <p className="text-xs text-gray-400 mb-4">
        Jamais visible du client — sert uniquement à calculer le bénéfice réel de cette commande.
      </p>

      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-gray-600 truncate">
              {item.quantity} × {item.label}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-xs text-gray-400">Coût d&apos;achat / unité</span>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="—"
                value={values[item.id]}
                onChange={(e) => setValues((v) => ({ ...v, [item.id]: e.target.value }))}
                className="w-24 border border-gray-200 rounded-lg px-2 py-1 text-sm text-right"
              />
              <span className="text-xs text-gray-400">€</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 text-sm mt-4 pt-4 border-t border-gray-100">
        <span className="text-gray-600">Frais de port réels payés (Chronopost, Colissimo...)</span>
        <div className="flex items-center gap-1 shrink-0">
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="—"
            value={shipping}
            onChange={(e) => setShipping(e.target.value)}
            className="w-24 border border-gray-200 rounded-lg px-2 py-1 text-sm text-right"
          />
          <span className="text-xs text-gray-400">€</span>
        </div>
      </div>

      <button
        type="button"
        onClick={save}
        disabled={isPending}
        className="mt-4 bg-gray-800 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-700 transition disabled:opacity-60"
      >
        {isPending ? 'Enregistrement...' : 'Enregistrer les coûts'}
      </button>
      {saved && <span className="ml-3 text-green-600 text-sm font-medium">✓ Enregistré</span>}
    </div>
  );
}
