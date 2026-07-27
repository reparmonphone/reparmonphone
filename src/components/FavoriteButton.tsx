'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toggleFavorite } from '@/app/compte/favoris/actions';

export default function FavoriteButton({
  productId,
  initialFavorited,
  className = '',
}: {
  productId: string;
  initialFavorited: boolean;
  className?: string;
}) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    // Optimiste : on bascule l'affichage immédiatement, on annule si le serveur refuse
    const next = !favorited;
    setFavorited(next);

    startTransition(async () => {
      const result = await toggleFavorite(productId);
      if ('error' in result && result.error === 'NOT_LOGGED_IN') {
        setFavorited(!next); // on annule le changement optimiste
        router.push('/compte/connexion');
        return;
      }
      if ('favorited' in result) {
        setFavorited(result.favorited);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-label={favorited ? 'Retirer des favoris' : 'Ajouter aux favoris'}
      aria-pressed={favorited}
      className={`inline-flex items-center justify-center transition-transform active:scale-90 disabled:opacity-60 ${className}`}
    >
      {favorited ? (
        // Coeur plein
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-6 h-6 text-red-500"
        >
          <path d="M12 21s-6.7-4.35-9.33-8.28C.86 10.02 1.4 6.6 4.2 5.1c2.28-1.22 4.9-.5 6.3 1.42C11.9 4.6 14.52 3.88 16.8 5.1c2.8 1.5 3.34 4.92 1.53 7.62C18.7 16.65 12 21 12 21z" />
        </svg>
      ) : (
        // Coeur vide
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          className="w-6 h-6 text-gray-400 hover:text-red-400"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 21s-6.7-4.35-9.33-8.28C.86 10.02 1.4 6.6 4.2 5.1c2.28-1.22 4.9-.5 6.3 1.42C11.9 4.6 14.52 3.88 16.8 5.1c2.8 1.5 3.34 4.92 1.53 7.62C18.7 16.65 12 21 12 21z"
          />
        </svg>
      )}
    </button>
  );
}
