'use client';

import { useState, useTransition } from 'react';
import { sendMailInRepairReply } from '../actions';

type Reply = {
  id: string;
  message: string;
  quotedEstimate: number | null;
  createdAt: Date;
};

export default function MailInRepairReplyForm({
  repairId,
  replies,
}: {
  repairId: string;
  replies: Reply[];
}) {
  const [message, setMessage] = useState('');
  const [price, setPrice] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const priceValue = price.trim() ? Number(price.replace(',', '.')) : null;
      const result = await sendMailInRepairReply(repairId, message, priceValue);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setSent(true);
      setMessage('');
      setPrice('');
      setTimeout(() => setSent(false), 4000);
    });
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5">
      <h2 className="font-semibold text-gray-800 mb-1">Répondre au client</h2>
      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
        ⚠️ Pense à inclure ici l'adresse d'envoi si tu valides la demande — elle n'est communiquée au
        client que dans cette réponse, jamais avant.
      </p>

      {replies.length > 0 && (
        <div className="space-y-3 mb-4">
          <p className="text-xs text-gray-400">Historique des réponses envoyées ({replies.length})</p>
          {replies.map((reply) => (
            <div key={reply.id} className="bg-gray-50 border border-gray-100 rounded-lg p-4">
              <p className="text-xs text-gray-400 mb-1">
                {new Date(reply.createdAt).toLocaleString('fr-FR')}
                {reply.quotedEstimate != null && (
                  <span className="ml-2 text-green-700 font-semibold">
                    💶 Devis {reply.quotedEstimate.toFixed(2)} €
                  </span>
                )}
              </p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{reply.message}</p>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={6}
          required
          placeholder="Ta réponse... (estimation, et adresse d'envoi si tu valides la demande)"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
        />
        <div>
          <label className="block text-xs text-gray-400 mb-1">
            Montant du devis (optionnel — si rempli, le client devra l'accepter ou le refuser avant de
            pouvoir envoyer son appareil)
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Ex : 89.90"
            className="w-40 border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={isPending}
          className="bg-brand text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-brand-dark transition disabled:opacity-60"
        >
          {isPending ? 'Envoi...' : '✉️ Envoyer la réponse par email'}
        </button>
        {sent && <span className="ml-3 text-green-600 text-sm font-medium">✓ Réponse envoyée</span>}
      </form>
    </div>
  );
}
