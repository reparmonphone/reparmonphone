'use client';

import { useState, useTransition } from 'react';
import { issueCredit, markAsRefunded, rejectClaim } from '../actions';

export default function ClaimResolutionForm({
  claimId,
  orderTotal,
  status,
}: {
  claimId: string;
  orderTotal: number;
  status: string;
}) {
  const [amount, setAmount] = useState(orderTotal.toFixed(2));
  const [note, setNote] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (status !== 'OPEN') {
    return (
      <div className="bg-gray-50 border border-gray-100 rounded-xl p-5 text-sm text-gray-500">
        Ce litige a déjà été traité.
      </div>
    );
  }

  function handleCredit() {
    setError(null);
    const parsed = Number(amount.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Montant invalide.');
      return;
    }
    startTransition(async () => {
      const result = await issueCredit(claimId, parsed);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setMessage(`✅ Avoir de ${parsed.toFixed(2)}€ accordé (code ${result.code}), email envoyé au client.`);
    });
  }

  function handleRefunded() {
    startTransition(async () => {
      await markAsRefunded(claimId, note);
      setMessage('✅ Litige marqué comme remboursé.');
    });
  }

  function handleReject() {
    startTransition(async () => {
      await rejectClaim(claimId, note);
      setMessage('Litige marqué comme refusé.');
    });
  }

  if (message) {
    return <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-5 text-sm">{message}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-100 rounded-xl p-5">
        <h2 className="font-semibold text-gray-800 mb-3">💳 Accorder un avoir</h2>
        <p className="text-sm text-gray-500 mb-3">
          Génère un code promo à usage unique du montant indiqué, envoyé automatiquement par email au client.
        </p>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-32"
          />
          <span className="text-sm text-gray-400">€</span>
          <button
            onClick={handleCredit}
            disabled={isPending}
            className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-dark transition disabled:opacity-60"
          >
            {isPending ? 'Envoi...' : 'Accorder cet avoir'}
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl p-5">
        <h2 className="font-semibold text-gray-800 mb-3">Autres actions</h2>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note interne (optionnelle)"
          rows={2}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3"
        />
        <div className="flex gap-2">
          <button
            onClick={handleRefunded}
            disabled={isPending}
            className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-700 transition disabled:opacity-60"
          >
            ✅ Marquer comme remboursé
          </button>
          <button
            onClick={handleReject}
            disabled={isPending}
            className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition disabled:opacity-60"
          >
            Refuser la réclamation
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          "Marquer comme remboursé" ne déclenche aucun virement — effectue d'abord le vrai remboursement
          dans le dashboard du moyen de paiement (liens ci-dessus), puis clique ici pour mettre à jour le suivi.
        </p>
      </div>
    </div>
  );
}
