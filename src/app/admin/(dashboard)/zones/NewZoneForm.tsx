'use client';

import { useState, useTransition } from 'react';
import { createZone } from './actions';

export default function NewZoneForm() {
  const [cityName, setCityName] = useState('');
  const [fee, setFee] = useState(30);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!cityName.trim()) return;
    startTransition(async () => {
      await createZone(cityName.trim(), fee);
      setCityName('');
      setFee(30);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-3">
      <input
        value={cityName}
        onChange={(e) => setCityName(e.target.value)}
        placeholder="Nom de la ville"
        className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
      />
      <input
        type="number"
        min="0"
        value={fee}
        onChange={(e) => setFee(parseFloat(e.target.value) || 0)}
        className="w-24 border border-gray-200 rounded-lg px-2 py-2 text-sm text-right"
      />
      <span className="text-gray-400 text-sm">€</span>
      <button
        type="submit"
        disabled={pending}
        className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-dark transition disabled:opacity-60"
      >
        Ajouter
      </button>
    </form>
  );
}
