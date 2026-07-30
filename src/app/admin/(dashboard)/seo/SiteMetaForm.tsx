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
  initialOgImageUrl,
}: {
  initialTitle: string;
  initialDescription: string;
  initialOgImageUrl: string;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [ogImageUrl, setOgImageUrl] = useState(initialOgImageUrl);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    startTransition(async () => {
      await saveSiteMeta(title.trim(), description.trim(), ogImageUrl.trim());
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

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">
          Image de partage (Open Graph — Facebook, WhatsApp, LinkedIn...)
        </label>
        <input
          value={ogImageUrl}
          onChange={(e) => setOgImageUrl(e.target.value)}
          placeholder="https://.../og-image-reparmonphone.png"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
        />
        <p className="text-xs text-gray-400 mt-1">
          Colle ici l&apos;URL de l&apos;image (upload-la d&apos;abord dans Supabase Storage). Format
          recommandé : 1200×630px, paysage. C&apos;est cette image qui s&apos;affiche quand quelqu&apos;un
          partage ton site sur les réseaux sociaux — elle sert de modèle par défaut pour toutes les pages
          qui n&apos;ont pas leur propre image (les fiches produits gardent leur propre photo).
        </p>
        {ogImageUrl && (
          <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden max-w-md">
            {/* Aperçu simple en <img> — pas besoin de next/image ici, c'est juste un aperçu admin */}
            <img
              src={ogImageUrl}
              alt="Aperçu de l'image Open Graph"
              className="w-full aspect-[1200/630] object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        )}
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
