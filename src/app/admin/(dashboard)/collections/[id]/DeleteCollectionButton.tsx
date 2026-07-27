'use client';

import { useTransition } from 'react';
import { deleteCollection } from '../actions';

export default function DeleteCollectionButton({ collectionId }: { collectionId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      onClick={() => { if (confirm('Supprimer cette collection ? (les produits ne sont pas supprimés, juste le regroupement)')) startTransition(() => deleteCollection(collectionId)); }}
      disabled={pending}
      className="text-red-500 text-sm hover:underline disabled:opacity-50 shrink-0"
    >
      Supprimer la collection
    </button>
  );
}
