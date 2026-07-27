'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/store/cart';

type ReorderItem = {
  productId: string;
  slug: string;
  title: string;
  price: number;
  imageUrl: string | null;
  quantity: number;
  inStock: boolean;
};

export default function ReorderButton({ items }: { items: ReorderItem[] }) {
  const router = useRouter();
  const addItem = useCart((s) => s.addItem);
  const [loading, setLoading] = useState(false);

  const availableItems = items.filter((i) => i.inStock);
  const unavailableCount = items.length - availableItems.length;

  function handleReorder() {
    setLoading(true);
    for (const item of availableItems) {
      addItem(
        {
          productId: item.productId,
          slug: item.slug,
          title: item.title,
          price: item.price,
          imageUrl: item.imageUrl,
        },
        item.quantity
      );
    }
    router.push('/panier');
  }

  if (availableItems.length === 0) {
    return (
      <p className="text-sm text-gray-500 text-center">
        Aucun article de cette commande n&apos;est actuellement disponible pour être recommandé.
      </p>
    );
  }

  return (
    <div className="text-center">
      <button
        onClick={handleReorder}
        disabled={loading}
        className="bg-brand text-white px-6 py-3 rounded-lg font-semibold hover:bg-brand-dark transition disabled:opacity-60"
      >
        🔁 Recommander la même chose
      </button>
      {unavailableCount > 0 && (
        <p className="text-xs text-gray-400 mt-2">
          {unavailableCount} article{unavailableCount > 1 ? 's' : ''} de cette commande n&apos;{unavailableCount > 1 ? 'existent' : 'existe'} plus en stock et ne {unavailableCount > 1 ? 'seront' : 'sera'} pas rajouté{unavailableCount > 1 ? 's' : ''}.
        </p>
      )}
    </div>
  );
}
