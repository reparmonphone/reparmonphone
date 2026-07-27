'use client';

import { useState, useTransition } from 'react';
import { resubmitAllToIndexNow } from './actions';

export default function IndexNowPanel({ indexNowKey, productsCount }: { indexNowKey: string; productsCount: number }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5">
      <p className="text-sm text-gray-500 mb-3">
        Clé IndexNow : <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{indexNowKey}</code>
        {' '}({productsCount} produits actifs prêts à être soumis)
      </p>
      <button
        onClick={() =>
          startTransition(async () => {
            const result = await resubmitAllToIndexNow();
            setMessage(`✅ ${result.count} URLs soumises à IndexNow (Bing/Yandex).`);
            setTimeout(() => setMessage(null), 5000);
          })
        }
        disabled={pending}
        className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 transition disabled:opacity-60"
      >
        {pending ? 'Envoi en cours...' : '🔄 Re-soumettre tout le catalogue à IndexNow'}
      </button>
      {message && <p className="text-sm text-green-600 mt-3">{message}</p>}
    </div>
  );
}
