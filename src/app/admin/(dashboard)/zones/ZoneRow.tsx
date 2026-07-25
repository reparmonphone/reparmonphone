'use client';

import { useState, useTransition } from 'react';
import { updateZoneFee, deleteZone } from './actions';

export default function ZoneRow({ zone }: { zone: { id: string; cityName: string; extraFee: number } }) {
  const [fee, setFee] = useState(zone.extraFee);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function save() {
    startTransition(async () => {
      await updateZoneFee(zone.id, fee);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  function remove() {
    if (confirm(`Supprimer la zone "${zone.cityName}" ?`)) {
      startTransition(() => deleteZone(zone.id));
    }
  }

  return (
    <div className="flex items-center gap-3 px-5 py-3">
      <span className="flex-1 font-medium text-gray-800">{zone.cityName}</span>
      <input
        type="number"
        min="0"
        step="1"
        value={fee}
        onChange={(e) => setFee(parseFloat(e.target.value) || 0)}
        className="w-24 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right"
      />
      <span className="text-gray-400 text-sm">€</span>
      <button
        onClick={save}
        disabled={pending}
        className="text-brand text-sm font-medium hover:underline disabled:opacity-50"
      >
        {saved ? '✅' : 'Enregistrer'}
      </button>
      <button onClick={remove} disabled={pending} className="text-red-500 text-sm hover:underline disabled:opacity-50">
        Supprimer
      </button>
    </div>
  );
}
