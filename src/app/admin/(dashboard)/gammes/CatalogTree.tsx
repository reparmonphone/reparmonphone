'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import {
  renameBrand,
  updateBrandSlug,
  createLine,
  renameLine,
  deleteLine,
  moveLine,
  reorderLines,
  deleteBrand,
  createModel,
  renameModel,
  moveModel,
  reorderModels,
  deleteModel,
  mergeIntoModel,
  updateLineImage,
  updateModelImage,
} from './actions';

type ModelData = {
  id: string;
  name: string;
  imageUrl: string | null;
  productCount: number;
  mergeSuggestion: { targetId: string; targetLabel: string } | null;
  sortOrder: number;
};
type LineData = { id: string; name: string; imageUrl: string | null; models: ModelData[] };
type BrandData = { id: string; name: string; slug: string; lines: LineData[] };

// Déplace l'élément à `fromIndex` vers `toIndex` dans une copie du tableau (utilisé par le
// glisser-déposer des gammes et des modèles ci-dessous).
function reorderArray<T>(arr: T[], fromIndex: number, toIndex: number): T[] {
  const copy = [...arr];
  const [moved] = copy.splice(fromIndex, 1);
  copy.splice(toIndex, 0, moved);
  return copy;
}

// Petite poignée ⠿ + gestion commune du glisser-déposer natif HTML5 pour une liste réordonnable.
// `dragIndex` est stocké dans un ref partagé (pas un state) pour rester synchro pendant le drag
// sans re-render inutile ; le drop ne fait qu'un seul appel serveur avec l'ordre complet final.
function DragHandle({ title, disabled }: { title: string; disabled?: boolean }) {
  return (
    <span
      className={`shrink-0 select-none text-sm leading-none ${
        disabled ? 'text-gray-200 cursor-not-allowed' : 'text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing'
      }`}
      title={title}
    >
      ⠿
    </span>
  );
}

// Toutes les gammes de toutes les marques, pour le sélecteur "déplacer vers"
function flattenLines(brands: BrandData[]) {
  return brands.flatMap((b) => b.lines.map((l) => ({ id: l.id, label: `${b.name} / ${l.name}` })));
}

// Tous les modèles de toutes les marques/gammes, pour le sélecteur manuel "fusionner vers..." —
// contrairement aux doublons détectés automatiquement (mergeSuggestion, qui ne repère que les noms
// strictement identiques dans deux gammes différentes), ceci permet de fusionner n'importe quel
// modèle vers n'importe quel autre (ex: nettoyer un modèle au nom bancal issu d'un import CSV).
function flattenModels(brands: BrandData[]) {
  return brands.flatMap((b) =>
    b.lines.flatMap((l) =>
      l.models.map((m) => ({ id: m.id, label: `${b.name} / ${l.name} / ${m.name}`, productCount: m.productCount }))
    )
  );
}

export default function CatalogTree({ brands }: { brands: BrandData[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const allLines = flattenLines(brands);
  const allModels = flattenModels(brands);

  function run(action: () => Promise<{ ok?: boolean; error?: string } | undefined>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result?.error) setError(result.error);
    });
  }

  // Tous les doublons détectés, tous brands/lignes confondus, pour une correction rapide sans déplier chaque gamme
  const duplicates = brands.flatMap((b) =>
    b.lines.flatMap((l) =>
      l.models
        .filter((m) => m.mergeSuggestion)
        .map((m) => ({ model: m, brandName: b.name, lineName: l.name }))
    )
  );

  return (
    <div className="space-y-6">
      {/* Datalist partagée par tous les champs "Fusionner vers..." de la page (un seul rendu, référencé
          par chaque input via list="all-models-datalist") : tape quelques lettres pour filtrer. */}
      <datalist id="all-models-datalist">
        {allModels.map((m) => (
          <option key={m.id} value={m.label} />
        ))}
      </datalist>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}

      {duplicates.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <h2 className="font-semibold text-amber-800 mb-1">⚠️ {duplicates.length} doublon(s) détecté(s)</h2>
          <p className="text-sm text-amber-700 mb-3">
            Même nom de modèle présent dans deux gammes différentes — souvent un reliquat de la migration
            (ex. un produit "A23" mal classé dans "Outils" alors que "A23" existe déjà sous Samsung / Galaxy A).
          </p>
          <div className="space-y-2">
            {duplicates.map(({ model, brandName, lineName }) => (
              <div key={model.id} className="flex items-center justify-between bg-white rounded-lg px-4 py-2 text-sm">
                <span>
                  <strong>{model.name}</strong> dans <span className="text-gray-500">{brandName} / {lineName}</span>{' '}
                  ({model.productCount} produit(s))
                </span>
                <button
                  onClick={() => run(() => mergeIntoModel(model.id, model.mergeSuggestion!.targetId))}
                  disabled={pending}
                  className="bg-amber-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-amber-600 transition disabled:opacity-60 shrink-0 ml-3"
                >
                  Fusionner vers {model.mergeSuggestion!.targetLabel}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {brands.map((brand) => (
        <BrandCard key={brand.id} brand={brand} allBrands={brands} allLines={allLines} allModels={allModels} pending={pending} run={run} />
      ))}
    </div>
  );
}

function BrandCard({
  brand,
  allBrands,
  allLines,
  allModels,
  pending,
  run,
}: {
  brand: BrandData;
  allBrands: BrandData[];
  allLines: { id: string; label: string }[];
  allModels: { id: string; label: string; productCount: number }[];
  pending: boolean;
  run: (action: () => Promise<{ ok?: boolean; error?: string } | undefined>) => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(brand.name);
  const [editingSlug, setEditingSlug] = useState(false);
  const [slug, setSlug] = useState(brand.slug);
  const [newLineName, setNewLineName] = useState('');
  const [expandedLine, setExpandedLine] = useState<string | null>(null);
  const [modelFilter, setModelFilter] = useState('');
  const otherBrands = allBrands.filter((b) => b.id !== brand.id);

  // Ordre local des gammes de cette marque, pour un retour visuel immédiat pendant le
  // glisser-déposer — resynchronisé dès que le serveur renvoie un ordre à jour (après un ajout,
  // une suppression, ou la confirmation du drag lui-même).
  const [orderedLines, setOrderedLines] = useState(brand.lines);
  useEffect(() => setOrderedLines(brand.lines), [brand.lines]);
  const dragLineIndex = useRef<number | null>(null);
  const [dropLineIndex, setDropLineIndex] = useState<number | null>(null);

  function handleLineDrop(targetIndex: number) {
    const fromIndex = dragLineIndex.current;
    dragLineIndex.current = null;
    setDropLineIndex(null);
    if (fromIndex === null || fromIndex === targetIndex) return;
    const next = reorderArray(orderedLines, fromIndex, targetIndex);
    setOrderedLines(next);
    run(() => reorderLines(brand.id, next.map((l) => l.id)));
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-1">
        {editingName ? (
          <>
            <input value={name} onChange={(e) => setName(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1 text-lg font-bold" />
            <button
              onClick={() => run(async () => { const r = await renameBrand(brand.id, name); setEditingName(false); return r; })}
              disabled={pending}
              className="text-brand text-sm hover:underline"
            >
              OK
            </button>
          </>
        ) : (
          <>
            <h2 className="text-lg font-bold">{brand.name}</h2>
            <button onClick={() => setEditingName(true)} className="text-xs text-gray-400 hover:text-brand">✏️ renommer</button>
            {brand.lines.length === 0 && (
              <button
                onClick={() => { if (confirm(`Supprimer la marque "${brand.name}" (vide) ?`)) run(() => deleteBrand(brand.id)); }}
                disabled={pending}
                className="text-xs text-red-400 hover:text-red-600 ml-auto"
              >
                🗑 supprimer cette marque (vide)
              </button>
            )}
          </>
        )}
      </div>

      <div className="flex items-center gap-2 mb-4 text-xs text-gray-400">
        <span>URL :</span>
        {editingSlug ? (
          <>
            <span>/marque/</span>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="border border-gray-200 rounded px-1.5 py-0.5 text-xs w-32"
            />
            <button
              onClick={() => run(async () => { const r = await updateBrandSlug(brand.id, slug); if (!r.error) setEditingSlug(false); return r; })}
              disabled={pending}
              className="text-brand hover:underline"
            >
              OK
            </button>
          </>
        ) : (
          <>
            <code className="bg-gray-50 px-1.5 py-0.5 rounded">/marque/{brand.slug}</code>
            <button onClick={() => setEditingSlug(true)} className="text-gray-400 hover:text-brand">✏️ modifier</button>
          </>
        )}
      </div>

      <div className="space-y-2">
        {orderedLines.map((line, index) => (
          <div
            key={line.id}
            draggable
            onDragStart={() => { dragLineIndex.current = index; }}
            onDragEnter={() => setDropLineIndex(index)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleLineDrop(index); }}
            onDragEnd={() => { dragLineIndex.current = null; setDropLineIndex(null); }}
            className={`border rounded-lg transition ${
              dropLineIndex === index ? 'border-brand border-2 bg-brand/5' : 'border-gray-100'
            }`}
          >
            <LineRow
              line={line}
              otherBrands={otherBrands}
              expanded={expandedLine === line.id}
              onToggle={() => { setExpandedLine(expandedLine === line.id ? null : line.id); setModelFilter(''); }}
              pending={pending}
              run={run}
            />
            {expandedLine === line.id && (
              <div className="border-t border-gray-100 px-4 py-3 space-y-2 bg-gray-50">
                {line.models.length === 0 ? (
                  <p className="text-xs text-gray-400">Aucun modèle dans cette gamme.</p>
                ) : (
                  <ModelsList
                    line={line}
                    allLines={allLines}
                    allModels={allModels}
                    pending={pending}
                    run={run}
                    modelFilter={modelFilter}
                    setModelFilter={setModelFilter}
                  />
                )}
                <NewModelForm lineId={line.id} pending={pending} run={run} />
              </div>
            )}
          </div>
        ))}
      </div>

      <form
        className="flex items-center gap-2 mt-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!newLineName.trim()) return;
          run(async () => {
            const r = await createLine(brand.id, newLineName);
            if (!r.error) setNewLineName('');
            return r;
          });
        }}
      >
        <input
          value={newLineName}
          onChange={(e) => setNewLineName(e.target.value)}
          placeholder="Nom de la nouvelle gamme"
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm flex-1"
        />
        <button type="submit" disabled={pending} className="bg-brand text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-brand-dark transition disabled:opacity-60">
          + Ajouter une gamme
        </button>
      </form>
    </div>
  );
}

function LineRow({
  line,
  otherBrands,
  expanded,
  onToggle,
  pending,
  run,
}: {
  line: LineData;
  otherBrands: BrandData[];
  expanded: boolean;
  onToggle: () => void;
  pending: boolean;
  run: (action: () => Promise<{ ok?: boolean; error?: string } | undefined>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(line.name);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const totalProducts = line.models.reduce((sum, m) => sum + m.productCount, 0);

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // permet de re-choisir le même fichier ensuite
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/admin/upload-line-image', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok || !data.url) {
        alert(data.error || "Échec de l'upload de l'image.");
        return;
      }
      run(() => updateLineImage(line.id, data.url));
    } catch {
      alert("Échec de l'upload de l'image.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2.5 flex-wrap">
      <DragHandle title="Glisser pour réordonner les gammes sur la page publique de la marque" />
      <button onClick={onToggle} className="text-gray-400 text-xs w-4">{expanded ? '▾' : '▸'}</button>

      <div className="w-8 h-8 rounded border border-gray-100 bg-gray-50 shrink-0 overflow-hidden flex items-center justify-center">
        {line.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={line.imageUrl} alt={line.name} className="w-full h-full object-contain" />
        ) : (
          <span className="text-gray-300 text-xs">📷</span>
        )}
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={pending || uploading}
        className="text-xs text-gray-400 hover:text-brand shrink-0"
        title="Changer l'image de cette gamme (affichée sur la page publique de la marque)"
      >
        {uploading ? '⏳' : '🖼️'} modifier image
      </button>

      {editing ? (
        <>
          <input value={name} onChange={(e) => setName(e.target.value)} className="border border-gray-200 rounded px-2 py-1 text-sm flex-1" />
          <button onClick={() => run(async () => { const r = await renameLine(line.id, name); setEditing(false); return r; })} disabled={pending} className="text-brand text-xs hover:underline">OK</button>
        </>
      ) : (
        <>
          <span className="font-medium text-sm flex-1">{line.name}</span>
          <span className="text-xs text-gray-400">{line.models.length} modèle(s) · {totalProducts} produit(s)</span>
          {otherBrands.length > 0 && (
            <select
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  const targetBrand = otherBrands.find((b) => b.id === e.target.value);
                  if (confirm(`Déplacer la gamme "${line.name}" vers la marque "${targetBrand?.name}" ?`)) {
                    run(() => moveLine(line.id, e.target.value));
                  }
                }
              }}
              disabled={pending}
              className="text-xs border border-gray-200 rounded px-1.5 py-1"
            >
              <option value="">Déplacer vers marque...</option>
              {otherBrands.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}
          <button onClick={() => setEditing(true)} className="text-xs text-gray-400 hover:text-brand">✏️</button>
          <button
            onClick={() => run(() => deleteLine(line.id))}
            disabled={pending || line.models.length > 0}
            className="text-xs text-red-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
            title={line.models.length > 0 ? 'Déplace ou supprime les modèles avant' : 'Supprimer cette gamme'}
          >
            🗑
          </button>
        </>
      )}
    </div>
  );
}

function NewModelForm({
  lineId,
  pending,
  run,
}: {
  lineId: string;
  pending: boolean;
  run: (action: () => Promise<{ ok?: boolean; error?: string } | undefined>) => void;
}) {
  const [newModelName, setNewModelName] = useState('');

  return (
    <form
      className="flex items-center gap-2 pt-1"
      onSubmit={(e) => {
        e.preventDefault();
        if (!newModelName.trim()) return;
        run(async () => {
          const r = await createModel(lineId, newModelName);
          if (!r.error) setNewModelName('');
          return r;
        });
      }}
    >
      <input
        value={newModelName}
        onChange={(e) => setNewModelName(e.target.value)}
        placeholder="Nom du nouveau modèle (ex: Galaxy S26)"
        className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs flex-1 bg-white"
      />
      <button type="submit" disabled={pending} className="bg-brand text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-brand-dark transition disabled:opacity-60">
        + Ajouter un modèle
      </button>
    </form>
  );
}

// Liste réordonnable (glisser-déposer) des modèles d'une gamme, avec son propre champ de
// recherche pour filtrer parmi les modèles affichés. Gère un ordre local (orderedModels) pour un
// retour visuel immédiat pendant le drag, resynchronisé dès que le serveur renvoie line.models à
// jour (ajout/suppression/fusion d'un modèle, ou confirmation du drag lui-même).
function ModelsList({
  line,
  allLines,
  allModels,
  pending,
  run,
  modelFilter,
  setModelFilter,
}: {
  line: LineData;
  allLines: { id: string; label: string }[];
  allModels: { id: string; label: string; productCount: number }[];
  pending: boolean;
  run: (action: () => Promise<{ ok?: boolean; error?: string } | undefined>) => void;
  modelFilter: string;
  setModelFilter: (v: string) => void;
}) {
  const [orderedModels, setOrderedModels] = useState(line.models);
  useEffect(() => setOrderedModels(line.models), [line.models]);
  const dragModelIndex = useRef<number | null>(null);
  const [dropModelIndex, setDropModelIndex] = useState<number | null>(null);

  function handleModelDrop(targetIndex: number) {
    const fromIndex = dragModelIndex.current;
    dragModelIndex.current = null;
    setDropModelIndex(null);
    if (fromIndex === null || fromIndex === targetIndex) return;
    const next = reorderArray(orderedModels, fromIndex, targetIndex);
    setOrderedModels(next);
    run(() => reorderModels(line.id, next.map((m) => m.id)));
  }

  const q = modelFilter.trim().toLowerCase();
  const filtered = q ? orderedModels.filter((m) => m.name.toLowerCase().includes(q)) : orderedModels;

  return (
    <>
      {line.models.length > 8 && (
        <input
          value={modelFilter}
          onChange={(e) => setModelFilter(e.target.value)}
          placeholder={`Rechercher parmi les ${line.models.length} modèles...`}
          className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs bg-white mb-1"
          autoFocus
        />
      )}
      {filtered.length === 0 ? (
        <p className="text-xs text-gray-400">Aucun modèle ne correspond à &laquo;&nbsp;{modelFilter}&nbsp;&raquo;.</p>
      ) : (
        // Le glisser-déposer se base sur la position réelle dans orderedModels (l'ordre complet,
        // pas la liste filtrée) — désactivé pendant une recherche pour éviter toute confusion sur
        // "où ça tombe ?" quand la liste affichée est un sous-ensemble.
        filtered.map((model) => {
          const fullIndex = orderedModels.findIndex((m) => m.id === model.id);
          return (
            <div
              key={model.id}
              draggable={!q}
              // stopPropagation partout : cette carte modèle est imbriquée dans la carte gamme
              // (elle aussi glissable, voir BrandCard) — sans ça, glisser un modèle déclencherait
              // aussi les gestionnaires de la gamme parente (surbrillance, voire un drop de gamme).
              onDragStart={(e) => { e.stopPropagation(); dragModelIndex.current = fullIndex; }}
              onDragEnter={(e) => { if (q) return; e.stopPropagation(); setDropModelIndex(fullIndex); }}
              onDragOver={(e) => { if (q) return; e.stopPropagation(); e.preventDefault(); }}
              onDrop={(e) => { if (q) return; e.stopPropagation(); e.preventDefault(); handleModelDrop(fullIndex); }}
              onDragEnd={(e) => { e.stopPropagation(); dragModelIndex.current = null; setDropModelIndex(null); }}
              className={dropModelIndex === fullIndex ? 'ring-2 ring-brand rounded-lg' : undefined}
            >
              <ModelRow
                model={model}
                allLines={allLines}
                allModels={allModels}
                currentLineId={line.id}
                pending={pending}
                run={run}
                canDrag={!q}
              />
            </div>
          );
        })
      )}
    </>
  );
}

function ModelRow({
  model,
  allLines,
  allModels,
  currentLineId,
  pending,
  run,
  canDrag,
}: {
  model: ModelData;
  allLines: { id: string; label: string }[];
  allModels: { id: string; label: string; productCount: number }[];
  currentLineId: string;
  pending: boolean;
  run: (action: () => Promise<{ ok?: boolean; error?: string } | undefined>) => void;
  canDrag: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(model.name);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showMerge, setShowMerge] = useState(false);
  const [mergeQuery, setMergeQuery] = useState('');

  function handleMergeSubmit() {
    const target = allModels.find((m) => m.label === mergeQuery && m.id !== model.id);
    if (!target) {
      alert('Tape le nom d\'un modèle puis choisis-le dans la liste proposée (marque / gamme / modèle).');
      return;
    }
    if (
      !confirm(
        `Fusionner "${model.name}" (${model.productCount} produit(s)) vers "${target.label}" ?\n\nTous les produits seront déplacés, puis "${model.name}" sera définitivement supprimé.`
      )
    ) {
      return;
    }
    run(async () => {
      const r = await mergeIntoModel(model.id, target.id);
      if (!r?.error) {
        setMergeQuery('');
        setShowMerge(false);
      }
      return r;
    });
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/admin/upload-line-image', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok || !data.url) {
        alert(data.error || "Échec de l'upload de l'image.");
        return;
      }
      run(() => updateModelImage(model.id, data.url));
    } catch {
      alert("Échec de l'upload de l'image.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="bg-white border border-gray-100 rounded-lg px-3 py-2">
    <div className="flex items-center gap-2">
      <DragHandle
        title={canDrag ? "Glisser pour réordonner l'affichage sur la page publique de la gamme" : 'Efface la recherche pour réordonner'}
        disabled={!canDrag}
      />
      <div className="w-7 h-7 rounded border border-gray-100 bg-gray-50 shrink-0 overflow-hidden flex items-center justify-center">
        {model.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={model.imageUrl} alt={model.name} className="w-full h-full object-contain" />
        ) : (
          <span className="text-gray-300 text-xs">📷</span>
        )}
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={pending || uploading}
        className="text-xs text-gray-400 hover:text-brand shrink-0"
        title="Changer l'image de ce modèle (affichée sur la page publique de la gamme)"
      >
        {uploading ? '⏳' : '🖼️'}
      </button>

      {editing ? (
        <>
          <input value={name} onChange={(e) => setName(e.target.value)} className="border border-gray-200 rounded px-2 py-1 text-sm flex-1" />
          <button onClick={() => run(async () => { const r = await renameModel(model.id, name); setEditing(false); return r; })} disabled={pending} className="text-brand text-xs hover:underline">OK</button>
        </>
      ) : (
        <>
          <span className="text-sm flex-1">{model.name}</span>
          {model.mergeSuggestion && (
            <button
              onClick={() => run(() => mergeIntoModel(model.id, model.mergeSuggestion!.targetId))}
              disabled={pending}
              className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium hover:bg-amber-200 transition"
              title={`Un modèle "${model.name}" existe déjà sous ${model.mergeSuggestion.targetLabel} — fusionner déplacera tous les produits là-bas et supprimera ce doublon.`}
            >
              ⚠️ Doublon avec {model.mergeSuggestion.targetLabel} — fusionner
            </button>
          )}
          <span className="text-xs text-gray-400">{model.productCount} produit(s)</span>
          <select
            defaultValue={currentLineId}
            onChange={(e) => { if (e.target.value !== currentLineId) run(() => moveModel(model.id, e.target.value)); }}
            disabled={pending}
            className="text-xs border border-gray-200 rounded px-1.5 py-1"
          >
            {allLines.map((l) => (
              <option key={l.id} value={l.id}>{l.label}</option>
            ))}
          </select>
          <button onClick={() => setEditing(true)} className="text-xs text-gray-400 hover:text-brand">✏️</button>
          <button
            onClick={() => setShowMerge((v) => !v)}
            disabled={pending}
            className="text-xs text-gray-400 hover:text-brand"
            title="Fusionner ce modèle vers un autre modèle (déplace tous ses produits puis le supprime) — utile même si ce n'est pas un doublon détecté automatiquement"
          >
            🔀
          </button>
          <button
            onClick={() => run(() => deleteModel(model.id))}
            disabled={pending || model.productCount > 0}
            className="text-xs text-red-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
            title={model.productCount > 0 ? 'Réaffecte ou fusionne les produits avant (bouton 🔀)' : 'Supprimer ce modèle'}
          >
            🗑
          </button>
        </>
      )}
    </div>
    {showMerge && (
      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100">
        <span className="text-xs text-gray-400 shrink-0">Fusionner vers :</span>
        <input
          value={mergeQuery}
          onChange={(e) => setMergeQuery(e.target.value)}
          list="all-models-datalist"
          placeholder="Tape le nom d'un modèle (marque / gamme / modèle)..."
          className="border border-gray-200 rounded-lg px-2 py-1 text-xs flex-1"
        />
        <button
          onClick={handleMergeSubmit}
          disabled={pending || !mergeQuery.trim()}
          className="bg-amber-500 text-white px-3 py-1 rounded-lg text-xs font-semibold hover:bg-amber-600 transition disabled:opacity-60 shrink-0"
        >
          Fusionner
        </button>
        <button onClick={() => { setShowMerge(false); setMergeQuery(''); }} className="text-xs text-gray-400 hover:text-gray-600 shrink-0">
          Annuler
        </button>
      </div>
    )}
    </div>
  );
}
