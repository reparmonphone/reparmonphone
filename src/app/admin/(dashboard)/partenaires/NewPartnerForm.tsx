'use client';

import { useState, useTransition } from 'react';
import { createPartner } from './actions';

export default function NewPartnerForm() {
  const [name, setName] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !linkUrl.trim()) return;
    startTransition(async () => {
      await createPartner({ name: name.trim(), logoUrl: null, linkUrl: linkUrl.trim() });
      setName('');
      setLinkUrl('');
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du partenaire" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
      <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
      <p className="text-xs text-gray-400">Tu pourras ajouter le logo juste après, en cliquant sur "Modifier".</p>
      <button type="submit" disabled={pending} className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-dark transition disabled:opacity-60">
        {pending ? 'Ajout...' : 'Ajouter'}
      </button>
    </form>
  );
}
