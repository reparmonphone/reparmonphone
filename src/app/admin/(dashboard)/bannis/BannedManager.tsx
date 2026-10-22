'use client';

import { useState, useTransition } from 'react';
import type { BanEntry } from '@/lib/bannedClients';
import { createManualBan, addIdentifier, removeIdentifier, unbanEntry, updateReason } from './actions';

type Kind = 'email' | 'phone' | 'ip' | 'address' | 'userId';

const KIND_LABEL: Record<Kind, string> = {
  email: 'E-mail',
  phone: 'Téléphone',
  ip: 'Adresse IP',
  address: 'Adresse postale',
  userId: 'Compte',
};

function Chip({ kind, value, onRemove, disabled }: { kind: Kind; value: string; onRemove: () => void; disabled: boolean }) {
  const shown = kind === 'userId' ? `compte …${value.slice(-6)}` : kind === 'phone' ? `…${value}` : value.replace('|', ' · ');
  return (
    <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-xs rounded-full pl-2.5 pr-1 py-1">
      <span className="text-gray-400">{KIND_LABEL[kind]}</span> <span className="font-mono">{shown}</span>
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        className="w-4 h-4 rounded-full text-gray-400 hover:bg-red-100 hover:text-red-600 leading-none"
        title="Retirer cet élément de la liste noire"
      >
        ×
      </button>
    </span>
  );
}

function EntryCard({ entry, onChange }: { entry: BanEntry; onChange: (list: BanEntry[]) => void }) {
  const [pending, start] = useTransition();
  const [kind, setKind] = useState<Kind>('email');
  const [value, setValue] = useState('');
  const [reason, setReason] = useState(entry.reason);
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<{ error?: string; entries?: BanEntry[] } | undefined>) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (res?.error) setError(res.error);
      else if (res?.entries) onChange(res.entries);
    });
  }

  const chips: { kind: Kind; value: string }[] = [
    ...entry.userIds.map((v) => ({ kind: 'userId' as Kind, value: v })),
    ...entry.emails.map((v) => ({ kind: 'email' as Kind, value: v })),
    ...entry.phones.map((v) => ({ kind: 'phone' as Kind, value: v })),
    ...entry.ips.map((v) => ({ kind: 'ip' as Kind, value: v })),
    ...entry.addresses.map((v) => ({ kind: 'address' as Kind, value: v })),
  ];

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-gray-900">🚫 {entry.label || 'Client banni'}</div>
          <div className="text-xs text-gray-400">
            Banni le {new Date(entry.createdAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
          </div>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (confirm(`Lever le bannissement de « ${entry.label || 'ce client'} » ? Son compte sera réactivé.`)) {
              run(() => unbanEntry(entry.id));
            }
          }}
          className="text-sm text-green-700 hover:underline disabled:opacity-50"
        >
          ✅ Débannir
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        {chips.length === 0 && <span className="text-xs text-gray-400">Aucun élément — ce bannissement ne bloque plus personne.</span>}
        {chips.map((c) => (
          <Chip
            key={`${c.kind}:${c.value}`}
            kind={c.kind}
            value={c.value}
            disabled={pending}
            onRemove={() => run(() => removeIdentifier(entry.id, c.kind, c.value))}
          />
        ))}
      </div>

      <form
        className="flex flex-wrap gap-2 mt-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!value.trim()) return;
          run(async () => {
            const res = await addIdentifier(entry.id, kind, value);
            if (!res?.error) setValue('');
            return res;
          });
        }}
      >
        <select value={kind} onChange={(e) => setKind(e.target.value as Kind)} className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm">
          <option value="email">E-mail</option>
          <option value="phone">Téléphone</option>
          <option value="ip">Adresse IP</option>
          <option value="address">Adresse postale</option>
        </select>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={kind === 'address' ? '17 avenue Guy Malé, 66650' : kind === 'ip' ? '88.181.253.175' : kind === 'phone' ? '06 84 40 17 91' : 'adresse@exemple.fr'}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm flex-1 min-w-[180px]"
        />
        <button type="submit" disabled={pending} className="bg-gray-800 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-gray-700 disabled:opacity-50">
          + Ajouter
        </button>
      </form>

      <div className="flex gap-2 mt-3">
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Motif (note interne, jamais montrée au client)"
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm flex-1"
        />
        {reason !== entry.reason && (
          <button type="button" disabled={pending} onClick={() => run(() => updateReason(entry.id, reason))} className="text-sm text-brand hover:underline">
            Enregistrer
          </button>
        )}
      </div>
      {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
    </div>
  );
}

export default function BannedManager({ initial }: { initial: BanEntry[] }) {
  const [entries, setEntries] = useState(initial);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ label: '', reason: '', email: '', phone: '', ip: '', addressLine1: '', addressZip: '' });

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await createManualBan(form);
      if (res && 'error' in res && res.error) setError(res.error);
      else if (res && 'entries' in res && res.entries) {
        setEntries(res.entries);
        setForm({ label: '', reason: '', email: '', phone: '', ip: '', addressLine1: '', addressZip: '' });
      }
    });
  }

  const input = 'border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-full';

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {entries.length === 0 && <p className="text-gray-500 text-sm">Aucun client banni pour le moment.</p>}
        {entries.map((e) => (
          <EntryCard key={e.id} entry={e} onChange={setEntries} />
        ))}
      </div>

      <form onSubmit={submit} className="bg-white border border-gray-100 rounded-xl p-5 space-y-3">
        <h2 className="font-semibold">Bannir quelqu&apos;un manuellement</h2>
        <p className="text-xs text-gray-500">
          Pour un client déjà inscrit, le plus simple est le bouton « Bannir » dans <em>Utilisateurs</em> : il récupère
          tout seul l&apos;e-mail, le téléphone, les adresses IP et les adresses de ses commandes.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <input className={input} placeholder="Nom (pour te repérer)" value={form.label} onChange={(e) => set('label', e.target.value)} />
          <input className={input} placeholder="Motif (note interne)" value={form.reason} onChange={(e) => set('reason', e.target.value)} />
          <input className={input} placeholder="E-mail" value={form.email} onChange={(e) => set('email', e.target.value)} />
          <input className={input} placeholder="Téléphone" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          <input className={input} placeholder="Adresse IP" value={form.ip} onChange={(e) => set('ip', e.target.value)} />
          <div className="flex gap-2">
            <input className={input} placeholder="Adresse (n° + rue)" value={form.addressLine1} onChange={(e) => set('addressLine1', e.target.value)} />
            <input className={`${input} max-w-[110px]`} placeholder="Code postal" value={form.addressZip} onChange={(e) => set('addressZip', e.target.value)} />
          </div>
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button type="submit" disabled={pending} className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50">
          {pending ? '...' : '🚫 Bannir'}
        </button>
      </form>
    </div>
  );
}
