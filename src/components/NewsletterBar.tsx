'use client';

import { useState } from 'react';

export default function NewsletterBar() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('loading');
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setStatus(res.ok ? 'done' : 'error');
      if (res.ok) setEmail('');
    } catch {
      setStatus('error');
    }
  }

  return (
    <section className="bg-teal-500">
      <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <h2 className="text-white text-xl md:text-2xl font-bold">Souscrivez à notre Newsletter !</h2>

        {status === 'done' ? (
          <p className="text-white font-medium">✅ Merci, c&apos;est noté !</p>
        ) : (
          <form onSubmit={handleSubmit} className="flex w-full md:w-auto gap-2">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Ton adresse email"
              className="flex-1 md:w-72 rounded-lg px-4 py-2.5 border-none"
            />
            <button
              type="submit"
              disabled={status === 'loading'}
              className="bg-gray-900 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-gray-800 transition disabled:opacity-60"
            >
              {status === 'loading' ? '...' : "S'inscrire"}
            </button>
          </form>
        )}
        {status === 'error' && <p className="text-white text-sm">Une erreur est survenue, réessaie.</p>}
      </div>
    </section>
  );
}
