'use client';

import { useState, useTransition } from 'react';
import { syncGoogleReviews } from './actions';

export default function SyncGoogleButton() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  function handleClick() {
    setMessage(null);
    startTransition(async () => {
      const result = await syncGoogleReviews();
      if ('error' in result) {
        setIsError(true);
        setMessage(result.error ?? 'Erreur inconnue.');
      } else {
        setIsError(false);
        setMessage(`✅ ${result.count} avis Google importés.`);
      }
    });
  }

  return (
    <div className="mb-6 bg-white border border-gray-100 rounded-xl p-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-semibold">Avis Google</h2>
          <p className="text-sm text-gray-500">
            Importe automatiquement tes avis Google via l&apos;API Google Places (max. 5 avis — c&apos;est une
            limite de l&apos;API Google, pas la nôtre). Nécessite <code>GOOGLE_PLACES_API_KEY</code> et{' '}
            <code>GOOGLE_PLACE_ID</code> dans <code>.env</code> (voir README).
          </p>
        </div>
        <button
          onClick={handleClick}
          disabled={pending}
          className="shrink-0 bg-[#4285F4] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#3367d6] transition disabled:opacity-60"
        >
          {pending ? 'Synchronisation...' : '🔄 Synchroniser les avis Google'}
        </button>
      </div>
      {message && (
        <p className={`text-sm mt-3 ${isError ? 'text-red-600' : 'text-green-600'}`}>{message}</p>
      )}
    </div>
  );
}
