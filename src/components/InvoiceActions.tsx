'use client';

import { useState } from 'react';

export default function InvoiceActions({
  orderId,
  allowCustomEmail = false,
}: {
  orderId: string;
  /** Admin uniquement : permet de saisir une autre adresse d'envoi que celle du client */
  allowCustomEmail?: boolean;
}) {
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [customEmail, setCustomEmail] = useState('');
  const [showEmailInput, setShowEmailInput] = useState(false);

  async function handleSend(email?: string) {
    setSending(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/factures/${orderId}/envoyer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(email ? { email } : {}),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "Erreur lors de l'envoi.");
      } else {
        setMessage(`✅ Facture envoyée à ${data.sentTo}`);
        setShowEmailInput(false);
      }
    } catch {
      setMessage("Erreur lors de l'envoi.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <a
        href={`/api/factures/${orderId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
      >
        🖨️ Voir / imprimer / enregistrer la facture
      </a>

      {!allowCustomEmail && (
        <button
          onClick={() => handleSend()}
          disabled={sending}
          className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-dark transition disabled:opacity-60"
        >
          {sending ? 'Envoi...' : '✉️ Recevoir par email'}
        </button>
      )}

      {allowCustomEmail && !showEmailInput && (
        <button
          onClick={() => setShowEmailInput(true)}
          className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-dark transition"
        >
          ✉️ Envoyer par email
        </button>
      )}

      {allowCustomEmail && showEmailInput && (
        <div className="flex items-center gap-2">
          <input
            type="email"
            value={customEmail}
            onChange={(e) => setCustomEmail(e.target.value)}
            placeholder="email@client.fr"
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
          <button
            onClick={() => handleSend(customEmail || undefined)}
            disabled={sending}
            className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-dark transition disabled:opacity-60"
          >
            {sending ? '...' : 'Envoyer'}
          </button>
        </div>
      )}

      {message && <span className="text-sm text-gray-600">{message}</span>}
    </div>
  );
}
