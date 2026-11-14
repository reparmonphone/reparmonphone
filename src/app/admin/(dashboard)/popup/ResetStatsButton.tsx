'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { resetPromoStats } from './actions';

export default function ResetStatsButton({ ctaHref }: { ctaHref: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!window.confirm('Remettre à zéro les compteurs de cette offre ? Cette action est définitive.')) return;
        setPending(true);
        resetPromoStats(ctaHref)
          .then(() => router.refresh())
          .catch(() => {})
          .finally(() => setPending(false));
      }}
      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
    >
      {pending ? 'Remise à zéro…' : 'Remettre à zéro'}
    </button>
  );
}
