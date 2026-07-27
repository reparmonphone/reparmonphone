'use client';

import { useState, useTransition } from 'react';
import { createMenuItem, updateMenuItem, deleteMenuItem, moveMenuItem } from './actions';

type MenuItem = { id: string; label: string; href: string; openInNewTab: boolean };

export default function MenuItemsList({ items }: { items: MenuItem[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<{ ok?: boolean; error?: string } | undefined>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="space-y-6">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}

      <div className="bg-white border border-gray-100 rounded-xl divide-y divide-gray-100">
        {items.length === 0 ? (
          <p className="p-5 text-gray-500 text-sm">Aucun lien pour le moment.</p>
        ) : (
          items.map((item, i) => (
            <MenuItemRow
              key={item.id}
              item={item}
              isFirst={i === 0}
              isLast={i === items.length - 1}
              pending={pending}
              run={run}
            />
          ))
        )}
      </div>

      <div className="bg-white border border-gray-100 rounded-xl p-5">
        <h2 className="font-semibold mb-3">Ajouter un lien</h2>
        <NewMenuItemForm run={run} pending={pending} />
      </div>
    </div>
  );
}

function MenuItemRow({
  item,
  isFirst,
  isLast,
  pending,
  run,
}: {
  item: MenuItem;
  isFirst: boolean;
  isLast: boolean;
  pending: boolean;
  run: (action: () => Promise<{ ok?: boolean; error?: string } | undefined>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(item.label);
  const [href, setHref] = useState(item.href);
  const [openInNewTab, setOpenInNewTab] = useState(item.openInNewTab);

  if (editing) {
    return (
      <div className="p-4 space-y-3 bg-gray-50">
        <div className="grid grid-cols-2 gap-3">
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Libellé (ex: Prendre RDV)" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          <input value={href} onChange={(e) => setHref(e.target.value)} placeholder="Lien (ex: /rdv)" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={openInNewTab} onChange={(e) => setOpenInNewTab(e.target.checked)} />
          Ouvrir dans un nouvel onglet
        </label>
        <div className="flex gap-3">
          <button
            onClick={() => run(async () => { const r = await updateMenuItem(item.id, { label, href, openInNewTab }); if (!r.error) setEditing(false); return r; })}
            disabled={pending}
            className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-dark transition disabled:opacity-60"
          >
            Enregistrer
          </button>
          <button onClick={() => setEditing(false)} className="text-gray-500 text-sm">Annuler</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 flex items-center gap-3">
      <div className="flex flex-col gap-0.5 shrink-0">
        <button onClick={() => run(() => moveMenuItem(item.id, 'up'))} disabled={pending || isFirst} className="text-gray-400 hover:text-brand disabled:opacity-20 text-xs leading-none">▲</button>
        <button onClick={() => run(() => moveMenuItem(item.id, 'down'))} disabled={pending || isLast} className="text-gray-400 hover:text-brand disabled:opacity-20 text-xs leading-none">▼</button>
      </div>
      <div className="flex-1">
        <p className="font-medium text-sm">{item.label}</p>
        <p className="text-xs text-gray-400">{item.href}{item.openInNewTab ? ' — nouvel onglet' : ''}</p>
      </div>
      <div className="flex gap-3 text-sm shrink-0">
        <button onClick={() => setEditing(true)} className="text-brand hover:underline">Modifier</button>
        <button
          onClick={() => { if (confirm(`Supprimer le lien "${item.label}" ?`)) run(() => deleteMenuItem(item.id)); }}
          disabled={pending}
          className="text-red-500 hover:underline disabled:opacity-50"
        >
          Supprimer
        </button>
      </div>
    </div>
  );
}

function NewMenuItemForm({
  run,
  pending,
}: {
  run: (action: () => Promise<{ ok?: boolean; error?: string } | undefined>) => void;
  pending: boolean;
}) {
  const [label, setLabel] = useState('');
  const [href, setHref] = useState('');
  const [openInNewTab, setOpenInNewTab] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim() || !href.trim()) return;
    run(async () => {
      const r = await createMenuItem({ label, href, openInNewTab });
      if (!r.error) {
        setLabel('');
        setHref('');
        setOpenInNewTab(false);
      }
      return r;
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Libellé (ex: Blog)" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        <input value={href} onChange={(e) => setHref(e.target.value)} placeholder="Lien (ex: /blog ou https://...)" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={openInNewTab} onChange={(e) => setOpenInNewTab(e.target.checked)} />
        Ouvrir dans un nouvel onglet
      </label>
      <button type="submit" disabled={pending} className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-dark transition disabled:opacity-60">
        + Ajouter
      </button>
    </form>
  );
}
