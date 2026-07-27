'use client';

import { useState, useTransition } from 'react';
import { sendReviewReminderManually } from '../actions';

export default function ReviewReminderButton({ orderId }: { orderId: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function handleClick() {
    setMessage(null);
    startTransition(async () => {
      const result = await sendReviewReminderManually(orderId);
      if (result.error) setMessage(result.error);
      else if (result.skipped) setMessage('Le client a déjà tout commenté — rien à envoyer.');
      else setMessage('✅ Email envoyé');
      setTimeout(() => setMessage(null), 3000);
    });
  }

  return (
    <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-3">
      <button onClick={handleClick} disabled={pending} className="text-amber-600 hover:underline text-sm font-medium disabled:opacity-50">
        {pending ? '...' : '✉️ Relancer pour laisser un avis'}
      </button>
      {message && <span className="text-xs text-gray-500">{message}</span>}
    </div>
  );
}
