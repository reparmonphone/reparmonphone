'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { sendReminderManually, deleteOrder } from './actions';

export default function OrderRowActions({ orderId, isPending }: { orderId: string; isPending: boolean }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function handleRemind() {
    setMessage(null);
    startTransition(async () => {
      const result = await sendReminderManually(orderId);
      setMessage(result.error ?? '✅ Email envoyé');
      setTimeout(() => setMessage(null), 3000);
    });
  }

  function handleDelete() {
    if (!confirm('Supprimer définitivement cette commande ? Cette action est irréversible.')) return;
    startTransition(async () => {
      await deleteOrder(orderId);
    });
  }

  return (
    <div className="flex items-center justify-end gap-3 whitespace-nowrap">
      {message && <span className="text-xs text-gray-500">{message}</span>}
      {isPending && (
        <button onClick={handleRemind} disabled={pending} className="text-amber-600 hover:underline text-xs font-medium disabled:opacity-50">
          {pending ? '...' : '✉️ Relancer'}
        </button>
      )}
      <Link href={`/admin/commandes/${orderId}`} className="text-brand hover:underline text-xs font-medium">
        Détail
      </Link>
      <button onClick={handleDelete} disabled={pending} className="text-red-500 hover:underline text-xs font-medium disabled:opacity-50">
        🗑
      </button>
    </div>
  );
}
