'use client';

import { useEffect, useState } from 'react';
import ProductReviewForm from '@/components/ProductReviewForm';

type Eligibility = { loggedIn: boolean; canReview: boolean; alreadyReviewed: boolean };

// Décide quoi afficher sous la liste d'avis (formulaire, message d'attente, ou invitation à se
// connecter) — chargé côté navigateur via /api/avis/eligibilite plutôt que côté serveur, pour que
// la fiche produit reste mise en cache. Rien ne s'affiche pendant le court chargement initial, pour
// éviter un flash "connecte-toi" incorrect pour un client déjà connecté.
export default function ReviewFormGate({ productId }: { productId: string }) {
  const [eligibility, setEligibility] = useState<Eligibility | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/avis/eligibilite?productId=${encodeURIComponent(productId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setEligibility(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [productId]);

  if (!eligibility) return null;

  if (eligibility.loggedIn && eligibility.canReview && !eligibility.alreadyReviewed) {
    return <ProductReviewForm productId={productId} />;
  }
  if (eligibility.loggedIn && !eligibility.canReview) {
    return (
      <p className="text-sm text-gray-400">
        Tu pourras laisser un avis une fois ta commande de ce produit marquée comme livrée.
      </p>
    );
  }
  if (!eligibility.loggedIn) {
    return (
      <p className="text-sm text-gray-400">
        Connecte-toi avec le compte utilisé pour ta commande pour laisser un avis sur ce produit.
      </p>
    );
  }
  return null;
}
