'use client';

import { useState, useTransition } from 'react';
import { updateInstagramFollowers } from './actions';

export default function InstagramFollowersForm({ initialValue }: { initialValue: string }) {
  const [value, setValue] = useState(initialValue);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await updateInstagramFollowers(value);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-3">
      <label className="text-sm font-medium">Nombre d&apos;abonnés Instagram</label>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="ex: 1,9K"
        className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-32"
      />
      <button type="submit" disabled={pending} className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-dark transition disabled:opacity-60">
        {pending ? '...' : 'Enregistrer'}
      </button>
      {saved && <span className="text-green-600 text-sm">✅</span>}
    </form>
  );
}
