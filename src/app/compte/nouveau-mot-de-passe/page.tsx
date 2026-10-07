'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

type Status = 'checking' | 'ready' | 'invalid' | 'done';

export default function NouveauMotDePassePage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Le lien reçu par email ouvre cette page avec une session de "récupération". Selon la configuration
  // Supabase elle arrive sous trois formes : ?code=... (flux PKCE, échangé automatiquement par le client),
  // ?token_hash=...&type=recovery (modèle d'email personnalisé), ou une erreur (#error=...) si le lien
  // est expiré/déjà utilisé. On gère les trois.
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let cancelled = false;

    const params = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const tokenHash = params.get('token_hash');

    if (hash.get('error') || params.get('error')) {
      setStatus('invalid');
      return;
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && session) setStatus('ready');
    });

    (async () => {
      if (tokenHash) {
        const { error: otpError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' });
        if (cancelled) return;
        setStatus(otpError ? 'invalid' : 'ready');
        return;
      }
      // Cas ?code=... : laisse au client le temps d'échanger le code, puis vérifie la session.
      await new Promise((r) => setTimeout(r, 1500));
      if (cancelled) return;
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setStatus((s) => (s === 'ready' ? s : data.session ? 'ready' : 'invalid'));
    })();

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Le mot de passe doit faire au moins 6 caractères.');
      return;
    }
    if (password !== confirm) {
      setError('Les deux mots de passe ne sont pas identiques.');
      return;
    }

    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(
        /different from the old password|same/i.test(updateError.message)
          ? "Choisis un mot de passe différent de l'ancien."
          : 'Impossible de changer le mot de passe. Le lien a peut-être expiré : refais une demande.'
      );
      return;
    }

    setStatus('done');
    setTimeout(() => {
      router.push('/compte');
      router.refresh();
    }, 1500);
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold mb-1">Nouveau mot de passe</h1>

      {status === 'checking' && <p className="text-gray-500 mt-4">Vérification du lien...</p>}

      {status === 'invalid' && (
        <div className="bg-white border border-gray-100 rounded-xl p-6 space-y-3 mt-6">
          <p className="font-medium">Ce lien n&apos;est plus valable.</p>
          <p className="text-sm text-gray-600">
            Il a expiré, a déjà été utilisé, ou a été ouvert dans un autre navigateur que celui de ta demande. Refais une
            demande et ouvre le nouveau lien depuis le même navigateur.
          </p>
          <Link
            href="/compte/mot-de-passe-oublie"
            className="inline-block bg-brand text-white py-2 px-4 rounded-lg font-semibold hover:bg-brand-dark transition"
          >
            Refaire une demande
          </Link>
        </div>
      )}

      {status === 'done' && (
        <div className="bg-white border border-gray-100 rounded-xl p-6 mt-6">
          <p className="font-medium text-green-700">Mot de passe changé. Redirection vers ton compte...</p>
        </div>
      )}

      {status === 'ready' && (
        <>
          <p className="text-gray-500 mb-6">Choisis un nouveau mot de passe pour ton compte.</p>
          <form onSubmit={handleSubmit} className="bg-white border border-gray-100 rounded-xl p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nouveau mot de passe</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Confirmer le mot de passe</label>
              <input
                type="password"
                required
                minLength={6}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2"
              />
            </div>

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand text-white py-2.5 rounded-lg font-semibold hover:bg-brand-dark transition disabled:opacity-60"
            >
              {loading ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
