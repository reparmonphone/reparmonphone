'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createGuide, updateGuide, deleteGuide, type GuideFormData, type GuideStepInput } from './actions';
import type { GuideDifficulty } from '@prisma/client';

type ModelOpt = { id: string; name: string };
type LineOpt = { id: string; name: string; models: ModelOpt[] };
type BrandOpt = { id: string; name: string; lines: LineOpt[] };

type InitialGuide = {
  id: string;
  title: string;
  excerpt: string;
  coverImageUrl: string;
  modelId: string | null;
  difficulty: GuideDifficulty;
  estimatedTime: string;
  toolsNeeded: string[];
  partsNeeded: string[];
  published: boolean;
  metaTitle: string;
  metaDescription: string;
  steps: GuideStepInput[];
};

const emptyStep: GuideStepInput = { title: '', contentHtml: '', imageUrl: '', warning: '' };

function findBrandAndLine(brands: BrandOpt[], modelId: string | null) {
  for (const brand of brands) {
    for (const line of brand.lines) {
      if (line.models.some((m) => m.id === modelId)) {
        return { brandId: brand.id, lineId: line.id };
      }
    }
  }
  return { brandId: '', lineId: '' };
}

export default function GuideForm({ brands, initialGuide }: { brands: BrandOpt[]; initialGuide?: InitialGuide }) {
  const router = useRouter();
  const isEditing = !!initialGuide;

  const initialLocation = findBrandAndLine(brands, initialGuide?.modelId ?? null);

  const [title, setTitle] = useState(initialGuide?.title ?? '');
  const [excerpt, setExcerpt] = useState(initialGuide?.excerpt ?? '');
  const [coverImageUrl, setCoverImageUrl] = useState(initialGuide?.coverImageUrl ?? '');
  const [brandId, setBrandId] = useState(initialLocation.brandId);
  const [lineId, setLineId] = useState(initialLocation.lineId);
  const [modelId, setModelId] = useState(initialGuide?.modelId ?? '');
  const [difficulty, setDifficulty] = useState<GuideDifficulty>(initialGuide?.difficulty ?? 'MOYEN');
  const [estimatedTime, setEstimatedTime] = useState(initialGuide?.estimatedTime ?? '');
  const [toolsText, setToolsText] = useState((initialGuide?.toolsNeeded ?? []).join('\n'));
  const [partsText, setPartsText] = useState((initialGuide?.partsNeeded ?? []).join('\n'));
  const [published, setPublished] = useState(initialGuide?.published ?? true);
  const [metaTitle, setMetaTitle] = useState(initialGuide?.metaTitle ?? '');
  const [metaDescription, setMetaDescription] = useState(initialGuide?.metaDescription ?? '');
  const [steps, setSteps] = useState<GuideStepInput[]>(
    initialGuide?.steps && initialGuide.steps.length > 0 ? initialGuide.steps : [{ ...emptyStep }]
  );

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const selectedBrand = brands.find((b) => b.id === brandId);
  const availableLines = selectedBrand?.lines ?? [];
  const selectedLine = availableLines.find((l) => l.id === lineId);
  const availableModels = selectedLine?.models ?? [];

  function updateStep(index: number, patch: Partial<GuideStepInput>) {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function addStep() {
    setSteps((prev) => [...prev, { ...emptyStep }]);
  }

  function removeStep(index: number) {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  }

  function moveStep(index: number, direction: -1 | 1) {
    setSteps((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (steps.some((s) => !s.title.trim() || !s.contentHtml.trim())) {
      setError('Chaque étape doit avoir un titre et un contenu.');
      return;
    }

    const data: GuideFormData = {
      title,
      excerpt,
      coverImageUrl,
      modelId: modelId || null,
      difficulty,
      estimatedTime,
      toolsNeeded: toolsText.split('\n').map((t) => t.trim()).filter(Boolean),
      partsNeeded: partsText.split('\n').map((t) => t.trim()).filter(Boolean),
      published,
      metaTitle,
      metaDescription,
      steps,
    };

    startTransition(async () => {
      const result = isEditing ? await updateGuide(initialGuide!.id, data) : await createGuide(data);
      if (result?.error) {
        setError(result.error);
        return;
      }
      if (isEditing) router.refresh();
    });
  }

  function handleDelete() {
    if (!initialGuide) return;
    if (!confirm(`Supprimer définitivement le guide "${initialGuide.title}" ?`)) return;
    startTransition(async () => {
      await deleteGuide(initialGuide.id);
      router.push('/admin/guides');
    });
  }

  const inputClass = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm';
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1';

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-4xl">
      {error && <p className="bg-red-50 text-red-700 text-sm rounded-lg p-3">{error}</p>}

      {/* Informations générales */}
      <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-gray-800">Informations générales</h2>

        <div>
          <label className={labelClass}>Titre du guide</label>
          <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ex: Remplacer l'écran d'un iPhone 14" className={inputClass} />
        </div>

        <div>
          <label className={labelClass}>Résumé (affiché sur les cartes)</label>
          <textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={2} placeholder="Une phrase qui résume le guide" className={inputClass} />
        </div>

        <div>
          <label className={labelClass}>Image de couverture (URL)</label>
          <input value={coverImageUrl} onChange={(e) => setCoverImageUrl(e.target.value)} placeholder="https://..." className={inputClass} />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelClass}>Marque</label>
            <select
              value={brandId}
              onChange={(e) => {
                setBrandId(e.target.value);
                setLineId('');
                setModelId('');
              }}
              className={inputClass}
            >
              <option value="">— Aucune (guide général) —</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Gamme</label>
            <select
              value={lineId}
              onChange={(e) => {
                setLineId(e.target.value);
                setModelId('');
              }}
              disabled={!brandId}
              className={inputClass}
            >
              <option value="">—</option>
              {availableLines.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Modèle</label>
            <select value={modelId} onChange={(e) => setModelId(e.target.value)} disabled={!lineId} className={inputClass}>
              <option value="">—</option>
              {availableModels.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-xs text-gray-400">
          Lier un modèle affiche automatiquement ce guide sur la fiche des produits correspondants. Laisse vide pour un guide général (non lié à un appareil précis).
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Difficulté</label>
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as GuideDifficulty)} className={inputClass}>
              <option value="FACILE">Facile</option>
              <option value="MOYEN">Moyen</option>
              <option value="DIFFICILE">Difficile</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Temps estimé</label>
            <input value={estimatedTime} onChange={(e) => setEstimatedTime(e.target.value)} placeholder="ex: 30-45 min" className={inputClass} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Outils nécessaires (un par ligne)</label>
            <textarea value={toolsText} onChange={(e) => setToolsText(e.target.value)} rows={3} placeholder={'Tournevis Pentalobe P2\nVentouse\nMédiator'} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Pièces nécessaires (un par ligne)</label>
            <textarea value={partsText} onChange={(e) => setPartsText(e.target.value)} rows={3} placeholder={"Écran de remplacement"} className={inputClass} />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
          Publié (visible sur le site)
        </label>
      </div>

      {/* Étapes */}
      <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Étapes ({steps.length})</h2>
          <button type="button" onClick={addStep} className="text-sm bg-brand text-white px-3 py-1.5 rounded-lg hover:bg-brand-dark transition">
            + Ajouter une étape
          </button>
        </div>

        {steps.map((step, index) => (
          <div key={index} className="border border-gray-200 rounded-xl p-4 space-y-3 relative">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-400">ÉTAPE {index + 1}</span>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => moveStep(index, -1)} disabled={index === 0} className="text-xs px-2 py-1 rounded hover:bg-gray-100 disabled:opacity-30">↑</button>
                <button type="button" onClick={() => moveStep(index, 1)} disabled={index === steps.length - 1} className="text-xs px-2 py-1 rounded hover:bg-gray-100 disabled:opacity-30">↓</button>
                <button type="button" onClick={() => removeStep(index)} disabled={steps.length === 1} className="text-xs px-2 py-1 rounded text-red-600 hover:bg-red-50 disabled:opacity-30">Supprimer</button>
              </div>
            </div>

            <input
              required
              value={step.title}
              onChange={(e) => updateStep(index, { title: e.target.value })}
              placeholder="Titre de l'étape (ex: Retirer les vis Pentalobe)"
              className={inputClass}
            />

            <textarea
              required
              value={step.contentHtml}
              onChange={(e) => updateStep(index, { contentHtml: e.target.value })}
              rows={3}
              placeholder="Description détaillée de l'étape"
              className={inputClass}
            />

            <input
              value={step.imageUrl}
              onChange={(e) => updateStep(index, { imageUrl: e.target.value })}
              placeholder="URL de la photo de l'étape (optionnel)"
              className={inputClass}
            />

            <input
              value={step.warning}
              onChange={(e) => updateStep(index, { warning: e.target.value })}
              placeholder="⚠️ Avertissement optionnel (ex: Attention à la nappe de batterie)"
              className={`${inputClass} border-amber-200`}
            />
          </div>
        ))}
      </div>

      {/* SEO */}
      <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-gray-800">SEO (optionnel)</h2>
        <div>
          <label className={labelClass}>Meta titre</label>
          <input value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Meta description</label>
          <textarea value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} rows={2} className={inputClass} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={isPending} className="bg-brand text-white px-6 py-3 rounded-lg font-semibold hover:bg-brand-dark transition disabled:opacity-60">
          {isPending ? 'Enregistrement...' : isEditing ? 'Enregistrer les modifications' : 'Créer le guide'}
        </button>
        {isEditing && (
          <button type="button" onClick={handleDelete} disabled={isPending} className="text-red-600 px-4 py-3 text-sm font-medium hover:bg-red-50 rounded-lg transition">
            Supprimer ce guide
          </button>
        )}
      </div>
    </form>
  );
}
