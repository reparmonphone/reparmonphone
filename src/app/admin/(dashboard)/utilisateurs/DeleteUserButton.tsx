'use client';

import { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { deleteAdminUser } from './actions';

export default function DeleteUserButton({ userId }: { userId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    if (!confirm('Supprimer définitivement ce compte utilisateur ? Cette action est irréversible.')) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteAdminUser(userId);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <>
      <button onClick={handleDelete} disabled={pending} className="text-red-500 hover:underline disabled:opacity-50">
        {pending ? '...' : 'Supprimer'}
      </button>
      {error && <p className="text-red-600 text-xs mt-1">{error}</p>}
    </>
  );
}
