'use client';

import { useState } from 'react';

// Affiché sur la fiche produit uniquement quand le produit est en rupture (voir page.tsx). Permet à
// un client (connecté ou non) de s'inscrire pour recevoir un email automatique dès que le produit
// redevient disponible — voir /api/stock-notifications et src/lib/stockNotifications.ts.
export default function StockNotifyForm({ productId }: { productId: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('loading');
    try {
      const res = await fetch('/api/stock-notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, email }),
      });
      setStatus(res.ok ? 'done' : 'error');
    } catch {
      setStatus('error');
    }
  }

  if (status === 'done') {
    return (
      <p className="mt-3 text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2.5">
        ✅ Vous serez averti·e par email dès que ce produit sera de nouveau disponible.
      </p>
    );
  }

  return (
    <div className="mt-3">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full md:w-auto bg-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-700 transition"
        >
          🔔 Me notifier quand ce produit sera de nouveau disponible
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Votre adresse email"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm"
          />
          <button
            type="submit"
            disabled={status === 'loading'}
            className="bg-red-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-red-700 transition disabled:opacity-60"
          >
            {status === 'loading' ? '...' : "M'avertir"}
          </button>
        </form>
      )}
      {status === 'error' && <p className="text-red-600 text-xs mt-1">Une erreur est survenue, réessaie.</p>}
      {open && status !== 'error' && (
        <p className="text-xs text-gray-400 mt-1.5">
          Un seul email, dès que le produit est de nouveau en stock. Voir notre{' '}
          <a href="/confidentialite" className="underline">politique de confidentialité</a>.
        </p>
      )}
    </div>
  );
}
