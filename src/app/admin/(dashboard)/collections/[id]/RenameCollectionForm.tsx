'use client';

import { useState, useTransition } from 'react';
import { renameCollection } from '../actions';

export default function RenameCollectionForm({ collectionId, initialName }: { collectionId: string; initialName: string }) {
  const [name, setName] = useState(initialName);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  return (
    <div className="flex items-center gap-3 flex-1">
      <label className="text-sm font-medium shrink-0">Nom</label>
      <input value={name} onChange={(e) => setName(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1" />
      <button
        onClick={() => startTransition(async () => { await renameCollection(collectionId, name); setSaved(true); setTimeout(() => setSaved(false), 1500); })}
        disabled={pending}
        className="text-brand text-sm font-medium hover:underline shrink-0"
      >
        {saved ? '✅' : 'Renommer'}
      </button>
    </div>
  );
}
