'use client';

import { useState, useTransition } from 'react';
import { createReferralLink } from './actions';

export default function NewReferralLinkForm() {
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim() || !url.trim()) return;
    startTransition(async () => {
      await createReferralLink({ label: label.trim(), url: url.trim() });
      setLabel('');
      setUrl('');
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-3">
      <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Libellé (ex: Gralon — Annuaire gratuit)" className="flex-1 min-w-[200px] border border-gray-200 rounded-lg px-3 py-2 text-sm" />
      <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." className="flex-1 min-w-[200px] border border-gray-200 rounded-lg px-3 py-2 text-sm" />
      <button type="submit" disabled={pending} className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-dark transition disabled:opacity-60">
        {pending ? 'Ajout...' : 'Ajouter'}
      </button>
    </form>
  );
}
