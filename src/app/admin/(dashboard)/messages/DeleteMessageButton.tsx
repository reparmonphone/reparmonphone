'use client';

import { useState, useTransition } from 'react';
import { deleteMessage } from './actions';

export default function DeleteMessageButton({ messageId }: { messageId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!confirming) {
      setConfirming(true);
      // Annule automatiquement la confirmation si le clic n'arrive pas dans les 4 secondes
      setTimeout(() => setConfirming(false), 4000);
      return;
    }
    startTransition(async () => {
      await deleteMessage(messageId);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition shrink-0 ${
        confirming
          ? 'bg-red-600 text-white hover:bg-red-700'
          : 'text-red-500 hover:bg-red-50'
      } disabled:opacity-60`}
    >
      {isPending ? '...' : confirming ? 'Confirmer ?' : '🗑️ Supprimer'}
    </button>
  );
}
