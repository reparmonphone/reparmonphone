'use client';

import { useState, useTransition } from 'react';
import { respondToMailInRepairQuote } from '@/app/reparation-a-distance/quoteActions';

// Composant partagé (page de suivi publique + espace compte) : affiche le devis proposé par l'admin
// et laisse le client l'accepter ou le refuser. Tant que la décision n'est pas prise, le formulaire de
// numéro de suivi reste masqué côté appelant — on ne peut pas envoyer l'appareil sans avoir validé le prix.
export default function MailInRepairQuoteDecision({ repairId, amount }: { repairId: string; amount: number }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<'ACCEPTED' | 'DECLINED' | null>(null);

  function respond(decision: 'ACCEPTED' | 'DECLINED') {
    setError(null);
    startTransition(async () => {
      const result = await respondToMailInRepairQuote(repairId, decision);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setDone(decision);
    });
  }

  if (done === 'ACCEPTED') {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-700 text-center">
        ✅ Devis accepté ! Vous pouvez maintenant nous envoyer votre appareil à l&apos;adresse indiquée
        dans notre réponse ci-dessus.
      </div>
    );
  }
  if (done === 'DECLINED') {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-600 text-center">
        Devis refusé. Une question ? Appelez-nous au{' '}
        <a href="tel:+33783497262" className="text-brand hover:underline">07 83 49 72 62</a>.
      </div>
    );
  }

  return (
    <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center">
      <p className="text-xs text-green-700 font-semibold mb-1">💶 Devis proposé</p>
      <p className="text-2xl font-bold text-gray-900 mb-1">{amount.toFixed(2)} €</p>
      <p className="text-xs text-green-700 mb-4">Renvoi Chronopost 24h inclus — rien à payer en plus.</p>
      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
      <div className="flex gap-3 justify-center">
        <button
          onClick={() => respond('ACCEPTED')}
          disabled={isPending}
          className="bg-green-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-green-700 transition disabled:opacity-60"
        >
          {isPending ? '...' : '✓ Accepter'}
        </button>
        <button
          onClick={() => respond('DECLINED')}
          disabled={isPending}
          className="bg-white border border-gray-300 text-gray-600 px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-50 transition disabled:opacity-60"
        >
          Refuser
        </button>
      </div>
    </div>
  );
}
