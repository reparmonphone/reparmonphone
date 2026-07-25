'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError('Email ou mot de passe incorrect.');
      setLoading(false);
      return;
    }

    if (data.user?.app_metadata?.role !== 'admin') {
      await supabase.auth.signOut();
      setError("Ce compte n'a pas accès à l'administration.");
      setLoading(false);
      return;
    }

    router.push('/admin');
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white border border-gray-100 rounded-xl p-6 shadow-sm">
        <h1 className="text-xl font-bold mb-1">Administration ReparMonPhone</h1>
        <p className="text-sm text-gray-500 mb-6">Connecte-toi pour gérer le site.</p>

        <label className="block text-sm font-medium mb-1">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 mb-4"
        />

        <label className="block text-sm font-medium mb-1">Mot de passe</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 mb-4"
        />

        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand text-white py-2.5 rounded-lg font-semibold hover:bg-brand-dark transition disabled:opacity-60"
        >
          {loading ? 'Connexion...' : 'Se connecter'}
        </button>
      </form>
    </div>
  );
}
