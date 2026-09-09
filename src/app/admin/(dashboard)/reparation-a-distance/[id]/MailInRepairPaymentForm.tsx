'use client';

import { useState, useTransition } from 'react';
import { sendMailInRepairPaymentLink } from '../actions';

export default function MailInRepairPaymentForm({
  repairId,
  quotedPrice,
}: {
  repairId: string;
  quotedPrice: number | null;
}) {
  const [price, setPrice] = useState(quotedPrice ? String(quotedPrice) : '');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const value = parseFloat(price.replace(',', '.'));
    if (!value || value <= 0) {
      setError('Indique un montant valide.');
      return;
    }
    startTransition(async () => {
      const result = await sendMailInRepairPaymentLink(repairId, value);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setSent(true);
      setTimeout(() => setSent(false), 4000);
    });
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5">
      <h2 className="font-semibold text-gray-800 mb-1">Envoyer le lien de paiement</h2>
      <p className="text-xs text-gray-500 mb-3">
        Le montant doit inclure la pièce, la main d'œuvre <strong>et le renvoi Chronopost 24h</strong> —
        c'est un tarif tout compris, jamais de frais de port ajoutés séparément. L'appareil n'est
        renvoyé qu'une fois ce paiement confirmé.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Montant total (€)</label>
          <input
            type="text"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="ex: 89.90"
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-40"
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="bg-brand text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-brand-dark transition disabled:opacity-60"
        >
          {isPending ? 'Envoi...' : '💳 Envoyer le lien de paiement'}
        </button>
        {sent && <span className="text-green-600 text-sm font-medium">✓ Lien envoyé</span>}
      </form>
      {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
    </div>
  );
}
