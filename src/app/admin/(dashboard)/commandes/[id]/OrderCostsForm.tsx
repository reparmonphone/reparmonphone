'use client';

import { useState, useTransition } from 'react';
import { updateOrderCosts } from '../actions';
import { formatPrice } from '@/lib/format';

// Coûts réels de la commande, visibles ADMIN UNIQUEMENT (jamais exposés côté client) : prix d'achat
// payé au fournisseur pour chaque article de CETTE commande précise (le prix pro peut varier d'une
// commande à l'autre, d'où une saisie manuelle plutôt qu'un prix par défaut sur la fiche produit), et
// frais de port réellement payés pour l'expédition (différents de ce que le client a payé). Alimente
// le calcul du bénéfice sur /admin/benefice.
//
// Saisie en HT ou en TTC (onglets). En base, les montants restent TOUJOURS enregistrés en HT : en mode
// TTC, la conversion (÷ 1,2) se fait à l'enregistrement. Les fournisseurs affichent souvent les prix de
// ligne en TTC et le sous-total / port en HT : on peut donc saisir chaque montant tel qu'il est écrit.
const VAT = 1.2;
const r2 = (n: number) => Math.round(n * 100) / 100;
const toNum = (v: string) => (v.trim() === '' || Number.isNaN(Number(v)) ? null : Math.max(0, Number(v)));

type Mode = 'HT' | 'TTC';

export default function OrderCostsForm({
  orderId,
  items,
  actualShippingCost,
  orderTotal,
  refunded,
  feeRate,
  feeFixed,
  providerLabel,
}: {
  orderId: string;
  items: { id: string; label: string; quantity: number; costPrice: number | null }[];
  actualShippingCost: number | null;
  orderTotal: number;
  refunded: boolean;
  feeRate: number; // % de la plateforme de paiement
  feeFixed: number; // montant fixe (€) en plus du %
  providerLabel: string;
}) {
  const hasValues = items.some((i) => i.costPrice != null) || actualShippingCost != null;
  // Commande déjà saisie : on affiche d'abord ce qui est enregistré (HT). Nouvelle saisie : TTC par défaut
  // (c'est ce que tu paies réellement, la TVA n'étant pas récupérable).
  const [mode, setMode] = useState<Mode>(hasValues ? 'HT' : 'TTC');
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(items.map((i) => [i.id, i.costPrice != null ? String(i.costPrice) : '']))
  );
  const [shipping, setShipping] = useState(actualShippingCost != null ? String(actualShippingCost) : '');
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function convert(v: string, from: Mode, to: Mode) {
    const n = toNum(v);
    if (n == null || from === to) return v;
    return String(r2(to === 'TTC' ? n * VAT : n / VAT));
  }

  function switchMode(next: Mode) {
    if (next === mode) return;
    setValues((cur) => Object.fromEntries(Object.entries(cur).map(([k, v]) => [k, convert(v, mode, next)])));
    setShipping((s) => convert(s, mode, next));
    setMode(next);
  }

  const toHT = (v: string): number | null => {
    const n = toNum(v);
    return n == null ? null : mode === 'TTC' ? r2(n / VAT) : n;
  };

  function save() {
    startTransition(async () => {
      await updateOrderCosts(orderId, {
        items: items.map((i) => ({ id: i.id, costPrice: toHT(values[i.id]) })),
        actualShippingCost: toHT(shipping),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    });
  }

  // ── Aperçu en direct (même calcul que /admin/benefice) ──
  const costHT = items.reduce((s, i) => s + i.quantity * (toHT(values[i.id]) ?? 0), 0);
  const shipHT = toHT(shipping) ?? 0;
  const totalHT = costHT + shipHT;
  const totalTTC = totalHT * VAT;
  const fee = orderTotal * (feeRate / 100) + feeFixed;
  const revenue = refunded ? 0 : orderTotal;
  const profit = revenue - fee - totalTTC;
  const missing = items.some((i) => values[i.id].trim() === '') || shipping.trim() === '';
  const otherMode: Mode = mode === 'HT' ? 'TTC' : 'HT';
  const hint = (v: string) => {
    const n = toNum(v);
    return n == null ? null : `≈ ${formatPrice(mode === 'TTC' ? n / VAT : n * VAT)} ${otherMode}`;
  };

  const tab = (m: Mode) =>
    `px-4 py-1.5 text-sm font-semibold rounded-lg transition ${
      mode === m ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-500 hover:text-gray-800'
    }`;

  return (
    <div id="couts" className="bg-white border border-gray-100 rounded-xl p-6 mb-4 scroll-mt-20">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h2 className="font-semibold">Coûts réels (admin uniquement)</h2>
        <div role="tablist" aria-label="Mode de saisie" className="inline-flex bg-gray-100 rounded-xl p-1">
          <button type="button" role="tab" aria-selected={mode === 'TTC'} onClick={() => switchMode('TTC')} className={tab('TTC')}>
            Saisie TTC
          </button>
          <button type="button" role="tab" aria-selected={mode === 'HT'} onClick={() => switchMode('HT')} className={tab('HT')}>
            Saisie HT
          </button>
        </div>
      </div>
      <p className="text-xs text-gray-400 mb-4">
        Jamais visible du client — sert uniquement à calculer le bénéfice réel de cette commande. Saisis chaque
        montant <strong>tel qu&apos;il est écrit chez ton fournisseur</strong> et choisis l&apos;onglet qui correspond :{' '}
        <strong>TTC</strong> (prix avec TVA) ou <strong>HT</strong> (prix hors taxes). La conversion est automatique.
      </p>

      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-gray-600 truncate">
              {item.quantity} × {item.label}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-xs text-gray-400">
                {hint(values[item.id]) && <em className="not-italic mr-2">{hint(values[item.id])}</em>}
                Coût d&apos;achat / unité ({mode})
              </span>
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
        <span className="text-gray-600">Frais de port réels payés {mode} (Chronopost, Colissimo...)</span>
        <div className="flex items-center gap-1 shrink-0">
          {hint(shipping) && <em className="not-italic text-xs text-gray-400 mr-1">{hint(shipping)}</em>}
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

      <div className="mt-4 rounded-xl bg-gray-50 border border-gray-100 p-4 text-sm space-y-1.5">
        <div className="flex justify-between">
          <span className="text-gray-600">Total payé au fournisseur (articles + port) — HT</span>
          <span className="font-medium">{formatPrice(totalHT)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">
            Total payé au fournisseur — <strong>TTC</strong>{' '}
            <span className="text-xs text-gray-400">(à comparer avec « Total TTC » de ta commande fournisseur)</span>
          </span>
          <span className="font-bold">{formatPrice(totalTTC)}</span>
        </div>
        <div className="flex justify-between text-gray-600">
          <span>
            Frais {providerLabel} ({feeRate}%{feeFixed > 0 ? ` + ${feeFixed} €` : ''})
          </span>
          <span>− {formatPrice(fee)}</span>
        </div>
        <div className="flex justify-between pt-2 mt-1 border-t border-gray-200">
          <span className="font-semibold">
            Bénéfice de cette commande{' '}
            <span className="text-xs font-normal text-gray-400">
              ({refunded ? 'remboursée, CA = 0' : `CA ${formatPrice(orderTotal)}`})
            </span>
          </span>
          <span className={`font-extrabold ${profit < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{formatPrice(profit)}</span>
        </div>
        {missing && (
          <p className="text-xs text-amber-600 pt-1">
            ⚠️ Un coût ou le port n&apos;est pas renseigné : il compte pour 0 €, le bénéfice affiché est surestimé.
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={save}
        disabled={isPending}
        className="mt-4 bg-gray-800 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-700 transition disabled:opacity-60"
      >
        {isPending ? 'Enregistrement...' : 'Enregistrer les coûts'}
      </button>
      {saved && <span className="ml-3 text-green-600 text-sm font-medium">✓ Enregistré (en HT)</span>}
    </div>
  );
}
