'use client';

import { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { banUser, unbanUser } from '../bannis/actions';

export default function BanUserButton({ userId, name, banned }: { userId: string; name: string; banned: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    if (banned) {
      if (!confirm(`Lever le bannissement de ${name} ? Son compte sera réactivé.`)) return;
      startTransition(async () => {
        await unbanUser(userId);
        router.refresh();
      });
      return;
    }
    const reason = prompt(
      `Bannir ${name} ?\n\nIl ne pourra plus commander, prendre rendez-vous, écrire, ouvrir un litige, laisser un avis ni se connecter (même avec un autre e-mail : son téléphone, son IP et ses adresses sont aussi bloqués).\n\nMotif (note interne, facultatif) :`,
      '',
    );
    if (reason === null) return;
    startTransition(async () => {
      const result = await banUser(userId, reason);
      if (result && 'error' in result && result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <>
      <button
        onClick={handleClick}
        disabled={pending}
        className={`mr-3 hover:underline disabled:opacity-50 ${banned ? 'text-green-700' : 'text-orange-600'}`}
        title={banned ? 'Lever le bannissement' : 'Bannir ce client de toutes les actions du site'}
      >
        {pending ? '...' : banned ? '✅ Débannir' : '🚫 Bannir'}
      </button>
      {error && <p className="text-red-600 text-xs mt-1">{error}</p>}
    </>
  );
}
