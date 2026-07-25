'use client';

import { useTransition } from 'react';
import { toggleMessageHandled } from './actions';

export default function MessageHandledToggle({ messageId, handled }: { messageId: string; handled: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      disabled={pending}
      onClick={() => startTransition(() => toggleMessageHandled(messageId, !handled))}
      className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition ${
        handled ? 'bg-gray-100 text-gray-500 hover:bg-gray-200' : 'bg-brand text-white hover:bg-brand-dark'
      } disabled:opacity-50`}
    >
      {handled ? '✅ Traité' : 'Marquer comme traité'}
    </button>
  );
}
