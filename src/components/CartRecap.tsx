'use client';

import { useEffect, useState } from 'react';
import { useCart } from '@/store/cart';
import { formatPrice } from '@/lib/format';

// Rappel du panier (nombre d'articles + total) affiché sur l'écran "Un compte est nécessaire" :
// le client voit tout de suite ce qu'il est sur le point de commander, et que rien n'est perdu.
// Le panier est stocké dans le navigateur ; on n'affiche le rappel qu'après le chargement côté client
// pour éviter tout écart avec le rendu serveur.
export default function CartRecap({ className = '' }: { className?: string }) {
  const [mounted, setMounted] = useState(false);
  const items = useCart((s) => s.items);

  useEffect(() => setMounted(true), []);

  if (!mounted || items.length === 0) return null;

  const count = items.reduce((s, i) => s + i.quantity, 0);
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);

  return (
    <div className={`bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm text-left ${className}`}>
      <p className="font-semibold text-gray-800">
        🛒 Ton panier : {count} article{count > 1 ? 's' : ''} — {formatPrice(total)}
      </p>
      <p className="text-xs text-gray-500 mt-0.5">Il est sauvegardé : tu le retrouveras juste après ta connexion.</p>
    </div>
  );
}
