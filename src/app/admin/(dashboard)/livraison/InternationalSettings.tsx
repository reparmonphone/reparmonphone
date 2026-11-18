'use client';

import { useState } from 'react';
import { saveInternationalShipping } from './actions';
import { EU_COUNTRIES, type InternationalConfig } from '@/lib/shippingInternational';

// Carte « Livraison à l'étranger » : un interrupteur général, deux options à tarif fixe et une case par pays.
export default function InternationalSettings({ initial }: { initial: InternationalConfig }) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [countries, setCountries] = useState<string[]>(initial.countries);
  const [options, setOptions] = useState(
    initial.options.map((o) => ({ ...o, price: String(o.price).replace('.', ',') }))
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const touch = () => setSaved(false);
  const toggleCountry = (code: string) => {
    touch();
    setCountries((cur) => (cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code]));
  };
  const setOpt = (id: string, patch: Partial<(typeof options)[number]>) => {
    touch();
    setOptions((cur) => cur.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  };

  function save() {
    setError(null);
    setSaved(false);
    setPending(true);
    saveInternationalShipping({ enabled, countries, options })
      .then((r) => {
        if ('error' in r && r.error) setError(r.error);
        else setSaved(true);
      })
      .catch(() => setError('Une erreur est survenue, réessaie.'))
      .finally(() => setPending(false));
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5">
      <h2 className="font-semibold mb-1">🌍 Livraison à l’étranger (Union européenne)</h2>
      <p className="text-xs text-gray-400 mb-4">
        Le client choisit son pays dans le panier. Dès que ce n’est pas la France (métropole et Outre-mer, qui restent gérées par les
        zones ci-dessous), ces deux options à tarif fixe remplacent les options habituelles. La livraison gratuite ne s’applique pas à l’étranger.
      </p>

      <label className="flex items-center gap-2 text-sm font-medium mb-4 cursor-pointer">
        <input type="checkbox" checked={enabled} onChange={(e) => { setEnabled(e.target.checked); touch(); }} />
        Proposer la livraison à l’étranger
      </label>

      <div className={enabled ? '' : 'opacity-50 pointer-events-none'}>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Options et tarifs</h3>
        <div className="space-y-3 mb-5">
          {options.map((o) => (
            <div key={o.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-100 p-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer" title="Proposer cette option">
                <input type="checkbox" checked={o.enabled} onChange={(e) => setOpt(o.id, { enabled: e.target.checked })} />
              </label>
              <input
                value={o.label}
                maxLength={80}
                onChange={(e) => setOpt(o.id, { label: e.target.value })}
                aria-label="Libellé"
                className="flex-1 basis-56 border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
              <input
                value={o.description}
                maxLength={120}
                onChange={(e) => setOpt(o.id, { description: e.target.value })}
                aria-label="Description"
                placeholder="Description (facultatif)"
                className="flex-1 basis-56 border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
              <div className="flex items-center gap-1">
                <input
                  value={o.price}
                  inputMode="decimal"
                  onChange={(e) => setOpt(o.id, { price: e.target.value })}
                  aria-label="Prix"
                  className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm text-right"
                />
                <span className="text-sm text-gray-500">€</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-700">
            Pays ouverts à la livraison <span className="font-normal text-gray-400">({countries.length} sur {EU_COUNTRIES.length})</span>
          </h3>
          <div className="flex gap-3 text-xs">
            <button type="button" onClick={() => { setCountries(EU_COUNTRIES.map((c) => c.code)); touch(); }} className="font-medium text-brand hover:underline">
              Tout cocher
            </button>
            <button type="button" onClick={() => { setCountries([]); touch(); }} className="font-medium text-brand hover:underline">
              Tout décocher
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3 lg:grid-cols-4 mb-5">
          {EU_COUNTRIES.map((c) => (
            <label key={c.code} className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={countries.includes(c.code)} onChange={() => toggleCountry(c.code)} />
              {c.name}
            </label>
          ))}
        </div>
      </div>

      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
      {saved && <p className="text-green-600 text-sm mb-3">✅ Enregistré : appliqué tout de suite dans le panier.</p>}

      <button
        onClick={save}
        disabled={pending}
        className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-dark transition disabled:opacity-50"
      >
        {pending ? 'Enregistrement...' : 'Enregistrer'}
      </button>
    </div>
  );
}
