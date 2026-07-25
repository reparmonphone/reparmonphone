'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

export default function InscriptionPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });

    if (error) {
      setError(error.message.includes('already registered') ? 'Un compte existe déjà avec cet email.' : "Erreur lors de l'inscription.");
      setLoading(false);
      return;
    }

    setLoading(false);

    // Si la confirmation email est désactivée dans Supabase, une session est déjà active.
    if (data.session) {
      router.push('/compte');
      router.refresh();
    } else {
      setDone(true);
    }
  }

  if (done) {
    return (
      <div className="max-w-sm mx-auto px-4 py-16 text-center">
        <div className="text-5xl mb-4">📧</div>
        <h1 className="text-xl font-bold mb-2">Vérifie ta boîte mail</h1>
        <p className="text-gray-600 text-sm">
          Un email de confirmation vient de t&apos;être envoyé. Clique sur le lien pour activer ton compte.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold mb-1">Créer un compte</h1>
      <p className="text-gray-500 mb-6">Pour suivre tes commandes et rendez-vous.</p>

      <form onSubmit={handleSubmit} className="bg-white border border-gray-100 rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Nom complet</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2"
          />
        </div>
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
        <div>
          <label className="block text-sm font-medium mb-1">Mot de passe</label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2"
          />
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand text-white py-2.5 rounded-lg font-semibold hover:bg-brand-dark transition disabled:opacity-60"
        >
          {loading ? 'Création...' : 'Créer mon compte'}
        </button>
      </form>

      <p className="text-sm text-gray-500 mt-4 text-center">
        Déjà un compte ?{' '}
        <Link href="/compte/connexion" className="text-brand font-medium hover:underline">
          Se connecter
        </Link>
      </p>
    </div>
  );
}
