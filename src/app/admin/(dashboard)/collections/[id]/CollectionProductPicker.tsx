'use client';

import { useMemo, useState, useTransition } from 'react';
import { setCollectionProducts, setProductsShowInBoutique } from '../actions';
import { formatPrice } from '@/lib/format';

type ProductOpt = {
  id: string;
  title: string;
  price: number;
  showInBoutique: boolean;
  brandName: string;
  lineName: string;
  modelName: string;
};

export default function CollectionProductPicker({
  collectionId,
  initialProductIds,
  products,
}: {
  collectionId: string;
  initialProductIds: string[];
  products: ProductOpt[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialProductIds));
  const [hiddenState, setHiddenState] = useState<Set<string>>(
    new Set(products.filter((p) => !p.showInBoutique).map((p) => p.id))
  );
  const [query, setQuery] = useState('');
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [showOnlySelected, setShowOnlySelected] = useState(false);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function save() {
    startTransition(async () => {
      await setCollectionProducts(collectionId, Array.from(selected));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  async function toggleBoutiqueVisibility() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    // Si au moins un est visible, l'action "masquer" est proposée ; sinon on les rend tous visibles.
    const anyVisible = ids.some((id) => !hiddenState.has(id));
    startTransition(async () => {
      await setProductsShowInBoutique(ids, !anyVisible);
      setHiddenState((prev) => {
        const next = new Set(prev);
        for (const id of ids) {
          if (anyVisible) next.add(id);
          else next.delete(id);
        }
        return next;
      });
    });
  }

  const filtered = useMemo(() => {
    let list = products;
    if (showOnlySelected) list = list.filter((p) => selected.has(p.id));
    const q = query.trim().toLowerCase();
    if (!q) return list.slice(0, 150);
    return list.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.brandName.toLowerCase().includes(q) ||
        p.lineName.toLowerCase().includes(q) ||
        p.modelName.toLowerCase().includes(q)
    );
  }, [products, query, showOnlySelected, selected]);

  return (
    <div>
      <div className="sticky top-16 z-10 bg-gray-50 py-3 mb-4 space-y-2">
        <div className="flex items-center gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un produit, une marque, un modèle... (ex: reconditionné, iPhone 14)"
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1"
          />
          <label className="text-sm text-gray-600 flex items-center gap-1.5 shrink-0">
            <input type="checkbox" checked={showOnlySelected} onChange={(e) => setShowOnlySelected(e.target.checked)} />
            Sélectionnés uniquement
          </label>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm text-gray-500">{selected.size} produit(s) sélectionné(s)</span>
          <button
            onClick={toggleBoutiqueVisibility}
            disabled={pending || selected.size === 0}
            className="text-xs bg-amber-100 text-amber-700 px-3 py-1.5 rounded-lg font-medium hover:bg-amber-200 transition disabled:opacity-40"
          >
            Masquer/afficher la sélection dans "Pièces détachées"
          </button>
          <button
            onClick={save}
            disabled={pending}
            className="bg-brand text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-brand-dark transition disabled:opacity-60 ml-auto"
          >
            {pending ? 'Enregistrement...' : 'Enregistrer la sélection'}
          </button>
          {saved && <span className="text-green-600 text-sm">✅</span>}
        </div>
        {!query.trim() && !showOnlySelected && (
          <p className="text-xs text-gray-400">
            {products.length} produits au total — tape dans la recherche pour affiner (150 premiers affichés par défaut).
          </p>
        )}
      </div>

      <div className="bg-white border border-gray-100 rounded-xl divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="p-5 text-gray-500 text-sm">Aucun produit ne correspond.</p>
        ) : (
          filtered.map((p) => (
            <label key={p.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50">
              <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 truncate">{p.title}</p>
                <p className="text-xs text-gray-400">{p.brandName} / {p.lineName} / {p.modelName}</p>
              </div>
              {hiddenState.has(p.id) && (
                <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded shrink-0">masqué boutique</span>
              )}
              <span className="text-sm font-medium text-gray-700 shrink-0">{formatPrice(p.price)}</span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}
