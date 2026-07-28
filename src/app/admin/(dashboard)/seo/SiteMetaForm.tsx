'use client';

import { useState, useTransition } from 'react';
import { saveSiteMeta } from './metaActions';

const TITLE_MIN = 30;
const TITLE_MAX = 60;
const DESC_MIN = 120;
const DESC_MAX = 160;

function CounterHint({ length, min, max }: { length: number; min: number; max: number }) {
  const ok = length >= min && length <= max;
  const color = length === 0 ? 'text-gray-400' : ok ? 'text-green-600' : 'text-red-600';
  return (
    <span className={`text-xs font-medium ${color}`}>
      {length} caractères {ok ? '✓' : `(recommandé : ${min}–${max})`}
    </span>
  );
}

export default function SiteMetaForm({
  initialTitle,
  initialDescription,
}: {
  initialTitle: string;
  initialDescription: string;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    startTransition(async () => {
      await saveSiteMeta(title.trim(), description.trim());
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-medium text-gray-700">Titre du site (balise &lt;title&gt;)</label>
          <CounterHint length={title.length} min={TITLE_MIN} max={TITLE_MAX} />
        </div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="ex: ReparMonPhone | Pièces Détachées Téléphone - Sainte-Maxime"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
        />
        <p className="text-xs text-gray-400 mt-1">
          Affiché dans l&apos;onglet du navigateur et comme titre cliquable dans Google/Bing.
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-medium text-gray-700">Meta description</label>
          <CounterHint length={description.length} min={DESC_MIN} max={DESC_MAX} />
        </div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="ex: Réparation et pièces détachées à Sainte-Maxime..."
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
        />
        <p className="text-xs text-gray-400 mt-1">
          Le texte affiché sous le titre dans les résultats de recherche.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="bg-brand text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-brand-dark transition disabled:opacity-60"
        >
          {isPending ? 'Enregistrement...' : 'Enregistrer'}
        </button>
        {saved && <span className="text-green-600 text-sm font-medium">✓ Enregistré</span>}
      </div>
    </form>
  );
}
