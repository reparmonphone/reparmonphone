'use client';

import { useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toggleFavorite } from '@/app/compte/favoris/actions';
import { useFavorites } from '@/store/favorites';

export default function FavoriteButton({
  productId,
  className = '',
}: {
  productId: string;
  className?: string;
}) {
  // L'état favori/non-favori vient d'un store client partagé (chargé une seule fois via
  // /api/favoris) plutôt que d'une prop calculée côté serveur — ce qui permet à cette fiche produit
  // (et à la grille boutique) de rester en cache au lieu d'être régénérées à chaque visite.
  const load = useFavorites((s) => s.load);
  const loaded = useFavorites((s) => s.loaded);
  const favorited = useFavorites((s) => s.isFavorited(productId));
  const setFavorited = useFavorites((s) => s.setFavorited);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    load();
  }, [load]);

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    // Optimiste : on bascule l'affichage immédiatement, on annule si le serveur refuse
    const next = !favorited;
    setFavorited(productId, next);

    startTransition(async () => {
      const result = await toggleFavorite(productId);
      if ('error' in result && result.error === 'NOT_LOGGED_IN') {
        setFavorited(productId, !next); // on annule le changement optimiste
        router.push('/compte/connexion');
        return;
      }
      if ('favorited' in result) {
        setFavorited(productId, result.favorited);
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
