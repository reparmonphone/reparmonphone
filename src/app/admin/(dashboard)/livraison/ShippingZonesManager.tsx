'use client';

import { useState, useTransition } from 'react';
import { createShippingZone, updateShippingZone, deleteShippingZone, setShippingZoneRate } from './actions';
import { formatPrice } from '@/lib/format';

type ShippingOpt = { id: string; label: string; price: number };
type Zone = { id: string; name: string; postalPrefixes: string[] };
type Rate = { shippingOptionId: string; zoneId: string; price: number };

export default function ShippingZonesManager({
  options,
  zones,
  rates,
}: {
  options: ShippingOpt[];
  zones: Zone[];
  rates: Rate[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<{ ok?: boolean; error?: string } | undefined>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result?.error) setError(result.error);
    });
  }

  function rateFor(optionId: string, zoneId: string) {
    return rates.find((r) => r.shippingOptionId === optionId && r.zoneId === zoneId);
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-6 space-y-5">
      <div>
        <h2 className="font-semibold">Tarifs par zone (Outre-mer, Corse...)</h2>
        <p className="text-sm text-gray-500 mt-1">
          Par défaut, le prix ci-dessus s&apos;applique à toute la France. Crée une zone (ex: Guadeloupe /
          Martinique / Guyane / Réunion) pour lui donner un tarif différent — dès que le client saisit un
          code postal correspondant sur le panier, le bon tarif s&apos;applique automatiquement, pour
          chaque option de livraison.
        </p>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}

      {options.length === 0 ? (
        <p className="text-gray-400 text-sm">Ajoute d&apos;abord une option de livraison ci-dessus.</p>
      ) : zones.length === 0 ? (
        <p className="text-gray-400 text-sm">Aucune zone particulière pour le moment — tous les clients paient le tarif de base.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="py-2 pr-3">Option de livraison</th>
                <th className="py-2 px-3 text-right">France métro (base)</th>
                {zones.map((z) => (
                  <th key={z.id} className="py-2 px-3 text-right">{z.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {options.map((opt) => (
                <tr key={opt.id} className="border-b border-gray-50">
                  <td className="py-2 pr-3 font-medium">{opt.label}</td>
                  <td className="py-2 px-3 text-right text-gray-500">{formatPrice(opt.price)}</td>
                  {zones.map((z) => (
                    <ZoneRateCell
                      key={z.id}
                      optionId={opt.id}
                      zoneId={z.id}
                      basePrice={opt.price}
                      current={rateFor(opt.id, z.id)?.price ?? null}
                      pending={pending}
                      run={run}
                    />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="border-t border-gray-100 pt-5 space-y-3">
        {zones.map((z) => (
          <ZoneRow key={z.id} zone={z} pending={pending} run={run} />
        ))}
        <NewZoneForm run={run} pending={pending} />
      </div>
    </div>
  );
}

function ZoneRateCell({
  optionId,
  zoneId,
  basePrice,
  current,
  pending,
  run,
}: {
  optionId: string;
  zoneId: string;
  basePrice: number;
  current: number | null;
  pending: boolean;
  run: (action: () => Promise<{ ok?: boolean; error?: string } | undefined>) => void;
}) {
  const [value, setValue] = useState<string>(current === null ? '' : String(current));

  function save() {
    const trimmed = value.trim();
    const price = trimmed === '' ? null : parseFloat(trimmed);
    if (price !== null && (!Number.isFinite(price) || price < 0)) return;
    run(() => setShippingZoneRate(optionId, zoneId, price));
  }

  return (
    <td className="py-2 px-3 text-right">
      <div className="flex items-center justify-end gap-1.5">
        <input
          type="number"
          step="0.01"
          min="0"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          placeholder={`${basePrice}`}
          className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-sm text-right"
          disabled={pending}
        />
        <span className="text-gray-400">€</span>
      </div>
    </td>
  );
}

function ZoneRow({
  zone,
  pending,
  run,
}: {
  zone: Zone;
  pending: boolean;
  run: (action: () => Promise<{ ok?: boolean; error?: string } | undefined>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(zone.name);
  const [prefixes, setPrefixes] = useState(zone.postalPrefixes.join(', '));

  if (editing) {
    return (
      <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-3">
        <input value={name} onChange={(e) => setName(e.target.value)} className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        <input
          value={prefixes}
          onChange={(e) => setPrefixes(e.target.value)}
          placeholder="Préfixes CP, ex: 971, 972, 973"
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
        />
        <button
          onClick={() => run(async () => { const r = await updateShippingZone(zone.id, { name, postalPrefixes: prefixes }); if (!r.error) setEditing(false); return r; })}
          disabled={pending}
          className="bg-brand text-white px-3 py-2 rounded-lg text-sm font-semibold hover:bg-brand-dark transition disabled:opacity-60"
        >
          Enregistrer
        </button>
        <button onClick={() => setEditing(false)} className="text-gray-500 text-sm px-2">Annuler</button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="flex-1 font-medium">{zone.name}</span>
      <span className="text-gray-400 text-xs">CP : {zone.postalPrefixes.join(', ')}</span>
      <button onClick={() => setEditing(true)} className="text-brand hover:underline">Modifier</button>
      <button
        onClick={() => { if (confirm(`Supprimer la zone "${zone.name}" ?`)) run(() => deleteShippingZone(zone.id)); }}
        disabled={pending}
        className="text-red-500 hover:underline disabled:opacity-50"
      >
        Supprimer
      </button>
    </div>
  );
}

function NewZoneForm({
  run,
  pending,
}: {
  run: (action: () => Promise<{ ok?: boolean; error?: string } | undefined>) => void;
  pending: boolean;
}) {
  const [name, setName] = useState('');
  const [prefixes, setPrefixes] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !prefixes.trim()) return;
    run(async () => {
      const r = await createShippingZone({ name, postalPrefixes: prefixes });
      if (!r.error) {
        setName('');
        setPrefixes('');
      }
      return r;
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 pt-2">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom de la zone (ex: Corse)" className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
      <input
        value={prefixes}
        onChange={(e) => setPrefixes(e.target.value)}
        placeholder="Préfixes CP séparés par une virgule, ex: 20"
        className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
      />
      <button type="submit" disabled={pending} className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-dark transition disabled:opacity-60">
        + Ajouter une zone
      </button>
    </form>
  );
}
