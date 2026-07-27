'use client';

import { useMemo, useState, useTransition } from 'react';
import { setCollectionModels } from '../actions';

type ModelOpt = { id: string; name: string; productCount: number };
type LineOpt = { id: string; name: string; models: ModelOpt[] };
type BrandOpt = { id: string; name: string; lines: LineOpt[] };

export default function CollectionModelPicker({
  collectionId,
  initialModelIds,
  brands,
}: {
  collectionId: string;
  initialModelIds: string[];
  brands: BrandOpt[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialModelIds));
  const [query, setQuery] = useState('');
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function toggle(modelId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(modelId)) next.delete(modelId);
      else next.add(modelId);
      return next;
    });
  }

  function toggleLine(line: LineOpt, checkAll: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const m of line.models) {
        if (checkAll) next.add(m.id);
        else next.delete(m.id);
      }
      return next;
    });
  }

  function save() {
    startTransition(async () => {
      await setCollectionModels(collectionId, Array.from(selected));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  const filteredBrands = useMemo(() => {
    if (!query.trim()) return brands;
    const q = query.trim().toLowerCase();
    return brands
      .map((b) => ({
        ...b,
        lines: b.lines
          .map((l) => ({ ...l, models: l.models.filter((m) => m.name.toLowerCase().includes(q)) }))
          .filter((l) => l.models.length > 0),
      }))
      .filter((b) => b.lines.length > 0);
  }, [brands, query]);

  return (
    <div>
      <div className="sticky top-16 z-10 bg-gray-50 py-3 mb-4 flex items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filtrer les modèles..."
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1"
        />
        <span className="text-sm text-gray-500 shrink-0">{selected.size} sélectionné(s)</span>
        <button
          onClick={save}
          disabled={pending}
          className="bg-brand text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-brand-dark transition disabled:opacity-60 shrink-0"
        >
          {pending ? 'Enregistrement...' : 'Enregistrer la sélection'}
        </button>
        {saved && <span className="text-green-600 text-sm shrink-0">✅</span>}
      </div>

      <div className="space-y-4">
        {filteredBrands.map((brand) => (
          <div key={brand.id} className="bg-white border border-gray-100 rounded-xl p-4">
            <h2 className="font-bold mb-3">{brand.name}</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {brand.lines.map((line) => {
                const allChecked = line.models.length > 0 && line.models.every((m) => selected.has(m.id));
                return (
                  <div key={line.id}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-semibold text-gray-700">{line.name}</p>
                      <button
                        onClick={() => toggleLine(line, !allChecked)}
                        className="text-xs text-brand hover:underline"
                      >
                        {allChecked ? 'Tout décocher' : 'Tout cocher'}
                      </button>
                    </div>
                    <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                      {line.models.map((model) => (
                        <label key={model.id} className="flex items-center gap-2 text-sm py-0.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selected.has(model.id)}
                            onChange={() => toggle(model.id)}
                          />
                          <span className="flex-1">{model.name}</span>
                          <span className="text-xs text-gray-400">{model.productCount}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
