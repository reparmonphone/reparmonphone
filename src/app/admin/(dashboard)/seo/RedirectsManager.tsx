'use client';

import { useState, useTransition } from 'react';
import { createRedirect, deleteRedirect } from './actions';

type RedirectData = { id: string; fromPath: string; toPath: string; statusCode: number; hits: number };

export default function RedirectsManager({ redirects }: { redirects: RedirectData[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fromPath, setFromPath] = useState('');
  const [toPath, setToPath] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fromPath.trim() || !toPath.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await createRedirect({ fromPath, toPath, statusCode: 301 });
      if (result?.error) {
        setError(result.error);
        return;
      }
      setFromPath('');
      setToPath('');
    });
  }

  return (
    <div className="space-y-4">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}

      <div className="bg-white border border-gray-100 rounded-xl divide-y divide-gray-100">
        {redirects.length === 0 ? (
          <p className="p-5 text-gray-500 text-sm">Aucune redirection pour le moment.</p>
        ) : (
          redirects.map((r) => (
            <div key={r.id} className="p-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-mono truncate">
                  <span className="text-red-500">{r.fromPath}</span>
                  <span className="text-gray-400 mx-2">→</span>
                  <span className="text-green-600">{r.toPath}</span>
                </p>
                <p className="text-xs text-gray-400">{r.hits} redirection(s) effectuée(s)</p>
              </div>
              <button
                onClick={() => { if (confirm('Supprimer cette redirection ?')) startTransition(async () => { await deleteRedirect(r.id); }); }}
                disabled={pending}
                className="text-red-500 hover:underline text-sm disabled:opacity-50 shrink-0"
              >
                Supprimer
              </button>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-gray-100 rounded-xl p-5">
        <h3 className="font-semibold mb-3 text-sm">Ajouter une redirection</h3>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <input
            value={fromPath}
            onChange={(e) => setFromPath(e.target.value)}
            placeholder="Ancienne URL (ex: /produit/vieux-nom)"
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono"
          />
          <input
            value={toPath}
            onChange={(e) => setToPath(e.target.value)}
            placeholder="Nouvelle URL (ex: /produit/nouveau-nom)"
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono"
          />
        </div>
        <button type="submit" disabled={pending} className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-dark transition disabled:opacity-60">
          + Ajouter
        </button>
      </form>
    </div>
  );
}
