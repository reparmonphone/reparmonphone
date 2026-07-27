'use client';

import { useRef, useState, useTransition } from 'react';
import Image from 'next/image';
import { updatePartner, deletePartner } from './actions';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

type Partner = { id: string; name: string; logoUrl: string | null; linkUrl: string };

export default function PartnerRow({ partner }: { partner: Partner }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(partner.name);
  const [linkUrl, setLinkUrl] = useState(partner.linkUrl);
  const [logoUrl, setLogoUrl] = useState(partner.logoUrl);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const ext = file.name.split('.').pop();
      const path = `${partner.id}/logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('partners').upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from('partners').getPublicUrl(path);
      setLogoUrl(data.publicUrl);
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      alert(`Erreur Supabase : "${detail}". Si le bucket 'partners' existe déjà, vérifie sa politique RLS d'INSERT (voir README section "Upload de fichiers").`);
    } finally {
      setUploading(false);
    }
  }

  function save() {
    startTransition(async () => {
      await updatePartner(partner.id, { name, logoUrl, linkUrl });
      setEditing(false);
    });
  }

  function remove() {
    if (confirm(`Supprimer le partenaire "${partner.name}" ?`)) {
      startTransition(() => deletePartner(partner.id));
    }
  }

  if (!editing) {
    return (
      <div className="p-4 flex items-center gap-4">
        <div className="relative w-16 h-12 shrink-0 bg-gray-50 rounded flex items-center justify-center overflow-hidden">
          {partner.logoUrl ? (
            <Image src={partner.logoUrl} alt={partner.name} fill className="object-contain" />
          ) : (
            <span className="text-xs text-gray-400">Texte</span>
          )}
        </div>
        <div className="flex-1">
          <p className="font-medium text-sm">{partner.name}</p>
          <p className="text-xs text-gray-400 truncate max-w-xs">{partner.linkUrl}</p>
        </div>
        <div className="flex gap-3 text-sm shrink-0">
          <button onClick={() => setEditing(true)} className="text-brand hover:underline">Modifier</button>
          <button onClick={remove} disabled={pending} className="text-red-500 hover:underline disabled:opacity-50">Supprimer</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3 bg-gray-50">
      <div className="flex items-center gap-4">
        <div className="relative w-16 h-12 shrink-0 bg-white border border-gray-200 rounded flex items-center justify-center overflow-hidden">
          {logoUrl ? <Image src={logoUrl} alt="" fill className="object-contain" /> : <span className="text-[10px] text-gray-400">Aucun logo</span>}
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="text-sm text-brand hover:underline disabled:opacity-50"
        >
          {uploading ? 'Envoi...' : 'Changer le logo'}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
      </div>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du partenaire" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
      <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
      <div className="flex gap-3">
        <button onClick={save} disabled={pending} className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-dark transition disabled:opacity-60">
          Enregistrer
        </button>
        <button onClick={() => setEditing(false)} className="text-gray-500 text-sm">Annuler</button>
      </div>
    </div>
  );
}
