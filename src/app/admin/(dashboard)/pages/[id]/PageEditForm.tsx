'use client';

import { useState, useTransition } from 'react';
import { updatePage } from '../actions';

export default function PageEditForm({ page }: { page: { id: string; title: string; contentHtml: string } }) {
  const [title, setTitle] = useState(page.title);
  const [contentHtml, setContentHtml] = useState(page.contentHtml);
  const [showPreview, setShowPreview] = useState(false);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await updatePage(page.id, { title, contentHtml });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Titre de la page</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium">Contenu (HTML)</label>
          <button type="button" onClick={() => setShowPreview((v) => !v)} className="text-sm text-brand hover:underline">
            {showPreview ? 'Voir le code' : 'Aperçu'}
          </button>
        </div>

        {showPreview ? (
          <div
            className="prose prose-sm max-w-none border border-gray-200 rounded-lg p-4 bg-white min-h-[300px]"
            dangerouslySetInnerHTML={{ __html: contentHtml }}
          />
        ) : (
          <textarea
            value={contentHtml}
            onChange={(e) => setContentHtml(e.target.value)}
            rows={18}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 font-mono text-xs"
          />
        )}
        <p className="text-xs text-gray-400 mt-1">
          Contenu HTML brut (balises &lt;h2&gt;, &lt;p&gt;, &lt;strong&gt;, &lt;a&gt;...). Utilise "Aperçu" pour vérifier le rendu avant d&apos;enregistrer.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="bg-brand text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-brand-dark transition disabled:opacity-60"
        >
          {pending ? 'Enregistrement...' : 'Enregistrer'}
        </button>
        {saved && <span className="text-green-600 text-sm">✅ Enregistré</span>}
      </div>
    </form>
  );
}
