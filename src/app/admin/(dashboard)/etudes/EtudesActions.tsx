'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createStudy, importStudy } from './actions';

type Available = { slug: string; title: string; taskCount: number; doneCount: number };

export default function EtudesActions({ available }: { available: Available[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [question, setQuestion] = useState('');

  function runImport(slug: string) {
    setError('');
    startTransition(async () => {
      const res = await importStudy(slug);
      if ('error' in res && res.error) {
        setError(res.error);
        return;
      }
      if ('id' in res && res.id) router.push(`/admin/etudes/${res.id}`);
    });
  }

  function create(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    startTransition(async () => {
      const res = await createStudy({ title, question });
      if ('error' in res && res.error) {
        setError(res.error);
        return;
      }
      if ('id' in res && res.id) router.push(`/admin/etudes/${res.id}`);
    });
  }

  return (
    <div className="space-y-6">
      {available.map((a) => (
        <div key={a.slug} className="bg-brand-light border border-brand/20 rounded-xl p-5">
          <h2 className="font-semibold mb-1">Étude prête à importer</h2>
          <p className="text-sm text-gray-800 mb-1">{a.title}</p>
          <p className="text-sm text-gray-600 mb-3">
            {a.taskCount} actions à suivre
            {a.doneCount > 0 ? `, dont ${a.doneCount} déjà réalisées sur le site (cochées)` : ''}.
          </p>
          <button
            type="button"
            onClick={() => runImport(a.slug)}
            disabled={pending}
            className="bg-brand text-white font-medium px-4 py-2 rounded-lg hover:bg-brand-dark disabled:opacity-60"
          >
            {pending ? 'Import…' : "Importer cette étude"}
          </button>
        </div>
      ))}

      <form onSubmit={create} className="bg-white border border-gray-100 rounded-xl p-5 space-y-3">
        <h2 className="font-semibold">Nouvelle étude</h2>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titre (ex : Étude MiroFish n°2 — concurrents)"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
        />
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Question posée à l'étude (facultatif)"
          rows={3}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={pending || !title.trim()}
          className="bg-gray-900 text-white font-medium px-4 py-2 rounded-lg disabled:opacity-50"
        >
          Créer l&apos;étude
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
