'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

export default function MotDePasseOubliePage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/compte/nouveau-mot-de-passe`,
    });

    setLoading(false);

    // Limite d'envoi d'emails atteinte côté Supabase : on le dit clairement.
    if (error && (error.status === 429 || /rate limit/i.test(error.message))) {
      setError('Trop de demandes pour le moment. Réessaie dans quelques minutes.');
      return;
    }

    // Dans tous les autres cas (y compris email inconnu) on affiche le même message, pour ne pas
    // révéler quelles adresses ont un compte sur le site.
    setSent(true);
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold mb-1">Mot de passe oublié</h1>
      <p className="text-gray-500 mb-6">Indique ton email, on t&apos;envoie un lien pour choisir un nouveau mot de passe.</p>

      {sent ? (
        <div className="bg-white border border-gray-100 rounded-xl p-6 space-y-3">
          <p className="font-medium">Vérifie ta boîte mail.</p>
          <p className="text-sm text-gray-600">
            Si un compte existe avec l&apos;adresse <strong>{email}</strong>, tu vas recevoir un email avec un lien de
            réinitialisation (pense à regarder dans les courriers indésirables). Ouvre le lien dans ce même navigateur.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-100 rounded-xl p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2"
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand text-white py-2.5 rounded-lg font-semibold hover:bg-brand-dark transition disabled:opacity-60"
          >
            {loading ? 'Envoi...' : 'Envoyer le lien'}
          </button>
        </form>
      )}

      <p className="text-sm text-gray-500 mt-4 text-center">
        <Link href="/compte/connexion" className="text-brand font-medium hover:underline">
          Retour à la connexion
        </Link>
      </p>
    </div>
  );
}
