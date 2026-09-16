'use client';

import { useState, useTransition } from 'react';
import { createShippingOption, updateShippingOption, deleteShippingOption, moveShippingOption } from './actions';
import { formatPrice } from '@/lib/format';

type ShippingOpt = { id: string; label: string; description: string; price: number; active: boolean };

// Le prix stocké (option.price / colonne "price" en base) reste le prix TTC final facturé au
// client au panier — rien ne change côté panier/checkout/factures. Ce qui change, c'est la
// SAISIE admin : Krys reçoit des tarifs HT de la part de ses transporteurs (Chronopost, Colissimo...)
// et se les faisait facturer avec 20% de TVA en plus — mais les entrait tels quels comme prix
// client, oubliant d'ajouter cette TVA. Les formulaires ci-dessous prennent maintenant le prix HT
// en entrée et calculent/enregistrent automatiquement le TTC (HT × 1.2), pour éviter que l'erreur
// ne se reproduise. Le client ne voit toujours qu'un seul prix TTC, comme avant.
const VAT_RATE = 0.2;
function toTTC(priceHT: number) {
  return Math.round(priceHT * (1 + VAT_RATE) * 100) / 100;
}

export default function ShippingOptionsList({ options }: { options: ShippingOpt[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<{ ok?: boolean; error?: string } | undefined>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="space-y-6">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}

      <div className="bg-white border border-gray-100 rounded-xl divide-y divide-gray-100">
        {options.length === 0 ? (
          <p className="p-5 text-gray-500 text-sm">Aucune option de livraison pour le moment.</p>
        ) : (
          options.map((opt, i) => (
            <ShippingRow
              key={opt.id}
              option={opt}
              isFirst={i === 0}
              isLast={i === options.length - 1}
              pending={pending}
              run={run}
            />
          ))
        )}
      </div>

      <div className="bg-white border border-gray-100 rounded-xl p-5">
        <h2 className="font-semibold mb-3">Ajouter une option</h2>
        <NewShippingOptionForm run={run} pending={pending} />
      </div>
    </div>
  );
}

function ShippingRow({
  option,
  isFirst,
  isLast,
  pending,
  run,
}: {
  option: ShippingOpt;
  isFirst: boolean;
  isLast: boolean;
  pending: boolean;
  run: (action: () => Promise<{ ok?: boolean; error?: string } | undefined>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(option.label);
  const [description, setDescription] = useState(option.description);
  // Pré-remplissage : on part du principe que option.price est déjà le bon TTC (donc HT = TTC / 1.2).
  // Juste après le déploiement de ce correctif, ce n'est pas encore vrai pour les tarifs existants
  // (voir note dans le chat) — remplace alors cette valeur pré-remplie par le vrai tarif HT de ton
  // transporteur avant d'enregistrer, une seule fois par option.
  const [priceHT, setPriceHT] = useState(Math.round((option.price / (1 + VAT_RATE)) * 100) / 100);
  const [active, setActive] = useState(option.active);
  const priceTTC = toTTC(priceHT);

  if (editing) {
    return (
      <div className="p-4 space-y-3 bg-gray-50">
        <div className="grid grid-cols-2 gap-3">
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Libellé (ex: Chronopost 24h)" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          <div>
            <input type="number" step="0.01" min="0" value={priceHT} onChange={(e) => setPriceHT(parseFloat(e.target.value) || 0)} placeholder="Prix HT (€)" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            <p className="text-xs text-gray-400 mt-1">Prix HT (tarif transporteur) → {formatPrice(priceTTC)} TTC facturé au client</p>
          </div>
        </div>
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (ex: Livraison en 24h)" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Proposée aux clients
        </label>
        <div className="flex gap-3">
          <button
            onClick={() => run(async () => { const r = await updateShippingOption(option.id, { label, description, price: priceTTC, active }); if (!r.error) setEditing(false); return r; })}
            disabled={pending}
            className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-dark transition disabled:opacity-60"
          >
            Enregistrer
          </button>
          <button onClick={() => setEditing(false)} className="text-gray-500 text-sm">Annuler</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 flex items-center gap-3">
      <div className="flex flex-col gap-0.5 shrink-0">
        <button onClick={() => run(() => moveShippingOption(option.id, 'up'))} disabled={pending || isFirst} className="text-gray-400 hover:text-brand disabled:opacity-20 text-xs leading-none">▲</button>
        <button onClick={() => run(() => moveShippingOption(option.id, 'down'))} disabled={pending || isLast} className="text-gray-400 hover:text-brand disabled:opacity-20 text-xs leading-none">▼</button>
      </div>
      <div className="flex-1">
        <p className="font-medium text-sm flex items-center gap-2">
          {option.label}
          {!option.active && <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">masquée</span>}
        </p>
        {option.description && <p className="text-xs text-gray-400">{option.description}</p>}
      </div>
      <span className="font-semibold text-brand-dark shrink-0">{formatPrice(option.price)}</span>
      <div className="flex gap-3 text-sm shrink-0">
        <button onClick={() => setEditing(true)} className="text-brand hover:underline">Modifier</button>
        <button
          onClick={() => { if (confirm(`Supprimer "${option.label}" ?`)) run(() => deleteShippingOption(option.id)); }}
          disabled={pending}
          className="text-red-500 hover:underline disabled:opacity-50"
        >
          Supprimer
        </button>
      </div>
    </div>
  );
}

function NewShippingOptionForm({
  run,
  pending,
}: {
  run: (action: () => Promise<{ ok?: boolean; error?: string } | undefined>) => void;
  pending: boolean;
}) {
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [priceHT, setPriceHT] = useState(0);
  const priceTTC = toTTC(priceHT);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    run(async () => {
      const r = await createShippingOption({ label, description, price: priceTTC });
      if (!r.error) {
        setLabel('');
        setDescription('');
        setPriceHT(0);
      }
      return r;
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Libellé" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        <div>
          <input type="number" step="0.01" min="0" value={priceHT} onChange={(e) => setPriceHT(parseFloat(e.target.value) || 0)} placeholder="Prix HT (€)" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          {priceHT > 0 && <p className="text-xs text-gray-400 mt-1">→ {formatPrice(priceTTC)} TTC facturé au client</p>}
        </div>
      </div>
      <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (facultatif)" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
      <button type="submit" disabled={pending} className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-dark transition disabled:opacity-60">
        + Ajouter
      </button>
    </form>
  );
}
