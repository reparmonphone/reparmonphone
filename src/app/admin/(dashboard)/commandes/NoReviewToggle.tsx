'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setNoReviewRequest } from './actions';

// Interrupteur « Ne pas demander d'avis » d'une commande.
//  - variant "panel"   : grande case sur la fiche commande
//  - variant "compact" : petit bouton dans la liste des commandes
export default function NoReviewToggle({
  orderId,
  initialValue,
  variant = 'panel',
}: {
  orderId: string;
  initialValue: boolean;
  variant?: 'panel' | 'compact';
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !value;
    setValue(next);
    startTransition(async () => {
      try {
        await setNoReviewRequest(orderId, next);
        router.refresh();
      } catch {
        setValue(!next);
      }
    });
  }

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        title={value ? 'Aucune demande d’avis pour cette commande — cliquer pour réactiver' : 'Cliquer pour ne PAS envoyer de demande d’avis'}
        className={`text-xs px-2 py-1 rounded-md border transition disabled:opacity-50 whitespace-nowrap ${
          value ? 'bg-red-50 border-red-200 text-red-700' : 'border-gray-200 text-gray-400 hover:text-gray-700'
        }`}
      >
        {value ? '🚫 Pas d’avis' : '⭐ Avis OK'}
      </button>
    );
  }

  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input type="checkbox" checked={value} onChange={toggle} disabled={pending} className="mt-1 h-4 w-4 accent-red-600" />
      <span>
        <span className="text-sm font-medium text-gray-800">🚫 Ne pas demander d&apos;avis pour cette commande</span>
        <span className="block text-xs text-gray-500 mt-0.5">
          {value
            ? 'Activé : ce client ne recevra aucune demande d’avis automatique ni groupée (ses autres commandes non plus), et le bouton « Relancer pour laisser un avis » est désactivé.'
            : 'Désactivé : ce client recevra la demande d’avis automatiquement 10 jours après la livraison.'}
        </span>
      </span>
    </label>
  );
}
