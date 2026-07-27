'use client';

import { useState, useTransition } from 'react';
import { setMaintenanceMode } from './actions';

export default function MaintenanceToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !enabled;
    startTransition(async () => {
      await setMaintenanceMode(next);
      setEnabled(next);
    });
  }

  return (
    <div className={`rounded-xl border p-6 ${enabled ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-100'}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-gray-800">
            {enabled ? '🚧 Site actuellement en maintenance' : '✅ Site actuellement en ligne'}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {enabled
              ? 'Les visiteurs voient la page de maintenance. Désactive dès que tu as terminé.'
              : 'Tout le monde peut naviguer normalement sur le site.'}
          </p>
        </div>
        <button
          onClick={toggle}
          disabled={pending}
          className={`shrink-0 px-5 py-2.5 rounded-lg text-sm font-semibold transition disabled:opacity-60 ${
            enabled ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-amber-500 text-white hover:bg-amber-600'
          }`}
        >
          {pending ? '...' : enabled ? 'Repasser en ligne' : 'Activer la maintenance'}
        </button>
      </div>
    </div>
  );
}
