'use client';

import { useState, useTransition } from 'react';
import { sendAppointmentReply } from './actions';

export default function AppointmentReplyForm({
  appointmentId,
  initialReply,
  initialRepliedAt,
}: {
  appointmentId: string;
  initialReply: string | null;
  initialRepliedAt: Date | null;
}) {
  const [message, setMessage] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await sendAppointmentReply(appointmentId, message);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setSent(true);
      setMessage('');
      setTimeout(() => setSent(false), 4000);
    });
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5">
      <h2 className="font-semibold text-gray-800 mb-3">Répondre au client</h2>

      {initialReply && (
        <div className="bg-gray-50 border border-gray-100 rounded-lg p-4 mb-4">
          <p className="text-xs text-gray-400 mb-1">
            Dernière réponse envoyée {initialRepliedAt ? `le ${new Date(initialRepliedAt).toLocaleString('fr-FR')}` : ''}
          </p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{initialReply}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          required
          placeholder="Ta réponse... (le client la recevra directement par email, avec possibilité de te répondre)"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
        />
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
