'use client';

import { useState, useTransition } from 'react';
import { updateReviewsSummary } from './actions';

export default function ReviewsSummaryForm({
  source,
  label,
  initialTotal,
  initialAverage,
}: {
  source: 'google' | 'facebook';
  label: string;
  initialTotal: string;
  initialAverage: string;
}) {
  const [total, setTotal] = useState(initialTotal);
  const [average, setAverage] = useState(initialAverage);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="text-sm font-medium w-20 shrink-0">{label}</span>
      <label className="text-xs text-gray-500">Note globale</label>
      <input
        value={average}
        onChange={(e) => setAverage(e.target.value)}
        placeholder="4.8"
        className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm w-16"
      />
      <label className="text-xs text-gray-500">Nombre total d&apos;avis</label>
      <input
        value={total}
        onChange={(e) => setTotal(e.target.value)}
        placeholder="127"
        className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm w-20"
      />
      <button
        onClick={() =>
          startTransition(async () => {
            await updateReviewsSummary(source, { total, average });
            setSaved(true);
            setTimeout(() => setSaved(false), 1500);
          })
        }
        disabled={pending}
        className="bg-brand text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-brand-dark transition disabled:opacity-60"
      >
        {pending ? '...' : 'Enregistrer'}
      </button>
      {saved && <span className="text-green-600 text-sm">✅</span>}
    </div>
  );
}
