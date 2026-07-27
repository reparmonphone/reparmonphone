'use client';

import { useRef, useState, useTransition } from 'react';
import Image from 'next/image';
import { createPartner } from './actions';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

export default function NewPartnerForm() {
  const [name, setName] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const ext = file.name.split('.').pop();
      const path = `nouveau/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('partners').upload(path, file);
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('partners').getPublicUrl(path);
      setLogoUrl(data.publicUrl);
    } catch (e) {
      console.error(e);
      const detail = e instanceof Error ? e.message : String(e);
      setError(
        `Erreur Supabase : "${detail}". Si le bucket 'partners' existe déjà, c'est probablement une politique RLS manquante sur le bucket (autoriser l'INSERT pour les utilisateurs authentifiés) — voir README section "Upload de fichiers".`
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !linkUrl.trim()) return;
    startTransition(async () => {
      await createPartner({ name: name.trim(), logoUrl, linkUrl: linkUrl.trim() });
      setName('');
      setLinkUrl('');
      setLogoUrl(null);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex items-center gap-4">
        <div className="relative w-16 h-12 shrink-0 bg-white border border-gray-200 rounded flex items-center justify-center overflow-hidden">
          {logoUrl ? (
            <Image src={logoUrl} alt="" fill className="object-contain" />
          ) : (
            <span className="text-[10px] text-gray-400">Aucun logo</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="text-sm text-brand hover:underline disabled:opacity-50"
        >
          {uploading ? 'Envoi...' : 'Choisir un logo (facultatif)'}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
      </div>

      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du partenaire" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
      <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />

      {error && <p className="text-red-600 text-xs">{error}</p>}

      <button type="submit" disabled={pending} className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-dark transition disabled:opacity-60">
        {pending ? 'Ajout...' : 'Ajouter'}
      </button>
    </form>
  );
}
