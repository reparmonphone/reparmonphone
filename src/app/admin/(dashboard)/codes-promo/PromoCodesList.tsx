'use client';

import { useState, useTransition } from 'react';
import { createPromoCode, updatePromoCode, deletePromoCode } from './actions';
import type { PromoType } from '@prisma/client';

type PromoCodeData = {
  id: string;
  code: string;
  type: PromoType;
  value: number;
  active: boolean;
  expiresAt: string;
  maxUses: number | null;
  usedCount: number;
};

export default function PromoCodesList({ codes }: { codes: PromoCodeData[] }) {
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
        {codes.length === 0 ? (
          <p className="p-5 text-gray-500 text-sm">Aucun code promo pour le moment.</p>
        ) : (
          codes.map((c) => <PromoCodeRow key={c.id} code={c} pending={pending} run={run} />)
        )}
      </div>

      <div className="bg-white border border-gray-100 rounded-xl p-5">
        <h2 className="font-semibold mb-3">Créer un code promo</h2>
        <NewPromoCodeForm run={run} pending={pending} />
      </div>
    </div>
  );
}

function PromoCodeRow({
  code,
  pending,
  run,
}: {
  code: PromoCodeData;
  pending: boolean;
  run: (action: () => Promise<{ ok?: boolean; error?: string } | undefined>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(code.value);
  const [type, setType] = useState(code.type);
  const [active, setActive] = useState(code.active);
  const [expiresAt, setExpiresAt] = useState(code.expiresAt);
  const [maxUses, setMaxUses] = useState(code.maxUses ? String(code.maxUses) : '');

  const isExpired = code.expiresAt && new Date(code.expiresAt) < new Date();
  const isMaxedOut = code.maxUses !== null && code.usedCount >= code.maxUses;

  if (editing) {
    return (
      <div className="p-4 space-y-3 bg-gray-50">
        <div className="grid grid-cols-2 gap-3">
          <select value={type} onChange={(e) => setType(e.target.value as PromoType)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
            <option value="PERCENT">Pourcentage (%)</option>
            <option value="FIXED">Montant fixe (€)</option>
          </select>
          <input type="number" step="0.01" min="0" value={value} onChange={(e) => setValue(parseFloat(e.target.value) || 0)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Expire le (facultatif)</label>
            <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Utilisations max (facultatif)</label>
            <input type="number" min="1" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} placeholder="Illimité" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Actif
        </label>
        <div className="flex gap-3">
          <button
            onClick={() => run(async () => { const r = await updatePromoCode(code.id, { code: code.code, type, value, active, expiresAt, maxUses }); if (!r.error) setEditing(false); return r; })}
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
    <div className="p-4 flex items-center gap-4">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-gray-800">{code.code}</span>
          {!code.active && <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">désactivé</span>}
          {isExpired && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded">expiré</span>}
          {isMaxedOut && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded">épuisé</span>}
        </div>
        <p className="text-sm text-gray-500">
          {code.type === 'PERCENT' ? `${code.value}%` : `${code.value.toFixed(2)}€`} de réduction
          {code.expiresAt && ` — expire le ${new Date(code.expiresAt).toLocaleDateString('fr-FR')}`}
          {' — '}utilisé {code.usedCount}{code.maxUses ? `/${code.maxUses}` : ''} fois
        </p>
      </div>
      <div className="flex gap-3 text-sm shrink-0">
        <button onClick={() => setEditing(true)} className="text-brand hover:underline">Modifier</button>
        <button
          onClick={() => { if (confirm(`Supprimer le code "${code.code}" ?`)) run(() => deletePromoCode(code.id)); }}
          disabled={pending}
          className="text-red-500 hover:underline disabled:opacity-50"
        >
          Supprimer
        </button>
      </div>
    </div>
  );
}

function NewPromoCodeForm({
  run,
  pending,
}: {
  run: (action: () => Promise<{ ok?: boolean; error?: string } | undefined>) => void;
  pending: boolean;
}) {
  const [code, setCode] = useState('');
  const [type, setType] = useState<PromoType>('PERCENT');
  const [value, setValue] = useState(10);
  const [expiresAt, setExpiresAt] = useState('');
  const [maxUses, setMaxUses] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    run(async () => {
      const r = await createPromoCode({ code, type, value, expiresAt, maxUses });
      if (!r.error) {
        setCode('');
        setValue(10);
        setExpiresAt('');
        setMaxUses('');
      }
      return r;
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code (ex: ETE2026)" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm uppercase" />
      <div className="grid grid-cols-2 gap-3">
        <select value={type} onChange={(e) => setType(e.target.value as PromoType)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
          <option value="PERCENT">Pourcentage (%)</option>
          <option value="FIXED">Montant fixe (€)</option>
        </select>
        <input type="number" step="0.01" min="0" value={value} onChange={(e) => setValue(parseFloat(e.target.value) || 0)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Expire le (facultatif)</label>
          <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Utilisations max (facultatif)</label>
          <input type="number" min="1" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} placeholder="Illimité" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>
      <button type="submit" disabled={pending} className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-dark transition disabled:opacity-60">
        + Créer le code
      </button>
    </form>
  );
}
