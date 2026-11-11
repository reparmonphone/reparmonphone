'use client';

import { useEffect, useState } from 'react';
import { EXPEDITION_HEURE_LIMITE } from '@/data/expedition';
import { formatRemaining, shipPromise, type ShipPromise } from '@/lib/shippingCutoff';

// Promesse d'expédition sous le bouton « Ajouter au panier » : « Expédié aujourd'hui avant 20h pour une
// livraison le lendemain en Chronopost 24h », avec le temps restant avant l'heure limite. Calculée dans
// le navigateur (la fiche produit est mise en cache, donc l'heure ne peut pas venir du serveur).
// Avant le chargement (et pour Google), on affiche une phrase toujours vraie.
export default function ShipCountdown() {
  const [promise, setPromise] = useState<ShipPromise | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    setPromise(shipPromise());
    const id = window.setInterval(() => {
      setPromise(shipPromise());
      setTick((t) => t + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const h = EXPEDITION_HEURE_LIMITE;
  let title = `Commandé avant ${h}h (jours ouvrés) : expédié le jour même pour une livraison le lendemain en Chronopost 24h.`;
  let sub: string | null = null;
  let urgent = false;

  if (promise?.state === 'today') {
    const delivery = promise.deliveryLabel === 'demain' ? 'le lendemain' : promise.deliveryLabel;
    title = `Expédié aujourd'hui avant ${h}h pour une livraison ${delivery} en Chronopost 24h.`;
    sub = `Plus que ${formatRemaining(promise.remainingSeconds)} pour commander.`;
    urgent = promise.remainingSeconds < 3600;
  } else if (promise?.state === 'later') {
    title = `Commandez maintenant : expédié ${promise.dispatchLabel}, livré ${promise.deliveryLabel} en Chronopost 24h.`;
  }

  return (
    <div
      className="mt-3 flex items-start gap-3 rounded-xl border border-brand/20 bg-brand-light/40 px-3 py-2.5 text-sm text-gray-700"
      style={{ minHeight: 56 }}
    >
      <span className="mt-0.5 text-lg" aria-hidden="true">
        🚚
      </span>
      <div>
        <p className="font-semibold text-gray-900">{title}</p>
        {sub && (
          <p className={`mt-0.5 text-xs ${urgent ? 'font-semibold text-red-600' : 'text-gray-600'}`} aria-live="off">
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}
