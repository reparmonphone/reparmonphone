'use client';

import { useState, useTransition } from 'react';
import { createCollection } from './actions';

export default function NewCollectionForm() {
  const [name, setName] = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await createCollection(name);
      // createCollection redirige en cas de succès
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nom (ex: Reconditionnés)"
        className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
      />
      <button type="submit" disabled={pending} className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-dark transition disabled:opacity-60">
        {pending ? 'Création...' : '+ Créer'}
      </button>
      {error && <span className="text-red-600 text-sm">{error}</span>}
    </form>
  );
}
