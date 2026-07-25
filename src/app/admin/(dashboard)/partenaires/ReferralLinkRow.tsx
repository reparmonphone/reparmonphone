'use client';

import { useTransition } from 'react';
import { deleteReferralLink } from './actions';

export default function ReferralLinkRow({ link }: { link: { id: string; label: string; url: string } }) {
  const [pending, startTransition] = useTransition();

  function remove() {
    if (confirm(`Supprimer le lien "${link.label}" ?`)) {
      startTransition(() => deleteReferralLink(link.id));
    }
  }

  return (
    <div className="p-4 flex items-center justify-between gap-4">
      <div>
        <p className="font-medium text-sm">{link.label}</p>
        <p className="text-xs text-gray-400 truncate max-w-xs">{link.url}</p>
      </div>
      <button onClick={remove} disabled={pending} className="text-red-500 text-sm hover:underline disabled:opacity-50 shrink-0">
        Supprimer
      </button>
    </div>
  );
}
