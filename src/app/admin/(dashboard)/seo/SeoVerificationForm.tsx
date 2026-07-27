'use client';

import { useState, useTransition } from 'react';
import { updateSeoVerification } from './actions';

export default function SeoVerificationForm({ initialGoogle, initialBing }: { initialGoogle: string; initialBing: string }) {
  const [googleVerification, setGoogleVerification] = useState(initialGoogle);
  const [bingVerification, setBingVerification] = useState(initialBing);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Code de vérification Google Search Console</label>
        <input
          value={googleVerification}
          onChange={(e) => setGoogleVerification(e.target.value)}
          placeholder="ex: aBcD1234..."
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Code de vérification Bing Webmaster Tools</label>
        <input
          value={bingVerification}
          onChange={(e) => setBingVerification(e.target.value)}
          placeholder="ex: 1234ABCD..."
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono"
        />
      </div>
      <button
        onClick={() =>
          startTransition(async () => {
            await updateSeoVerification({ googleVerification, bingVerification });
            setSaved(true);
            setTimeout(() => setSaved(false), 1500);
          })
        }
        disabled={pending}
        className="bg-brand text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-brand-dark transition disabled:opacity-60"
      >
        {pending ? 'Enregistrement...' : 'Enregistrer'}
      </button>
      {saved && <span className="text-green-600 text-sm ml-3">✅ Enregistré</span>}
    </div>
  );
}
