'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

export default function InscriptionPage() {
  return (
    <Suspense fallback={null}>
      <InscriptionForm />
    </Suspense>
  );
}

function InscriptionForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/compte';
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressCity, setAddressCity] = useState('');
  const [addressZip, setAddressZip] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/inscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, email, password, phone, addressLine1, addressCity, addressZip }),
      });
      const result = await res.json();

      if (!res.ok) {
        setError(result.error ?? "Erreur lors de l'inscription.");
        setLoading(false);
        return;
      }

      // Le compte est créé côté serveur (admin API) — on établit maintenant la session côté client.
      const supabase = createSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError('Compte créé, mais la connexion automatique a échoué. Connecte-toi manuellement.');
        setLoading(false);
        return;
      }

      router.push(redirectTo);
      router.refresh();
    } catch {
      setError('Une erreur est survenue.');
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold mb-1">Créer un compte</h1>
      <p className="text-gray-500 mb-6">Pour suivre tes commandes et rendez-vous.</p>

      <form onSubmit={handleSubmit} className="bg-white border border-gray-100 rounded-xl p-6 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Prénom</label>
            <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Nom</label>
            <input required value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Mot de passe</label>
          <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Téléphone</label>
          <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="06 12 34 56 78" className="w-full border border-gray-200 rounded-lg px-3 py-2" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Adresse</label>
          <input required value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} placeholder="Numéro et nom de rue" className="w-full border border-gray-200 rounded-lg px-3 py-2 mb-2" />
          <div className="grid grid-cols-2 gap-2">
            <input required value={addressZip} onChange={(e) => setAddressZip(e.target.value)} placeholder="Code postal" className="w-full border border-gray-200 rounded-lg px-3 py-2" />
            <input required value={addressCity} onChange={(e) => setAddressCity(e.target.value)} placeholder="Ville" className="w-full border border-gray-200 rounded-lg px-3 py-2" />
          </div>
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
        <Link href={`/compte/connexion${redirectTo !== '/compte' ? `?redirect=${redirectTo}` : ''}`} className="text-brand font-medium hover:underline">
          Se connecter
        </Link>
      </p>
    </div>
  );
}
