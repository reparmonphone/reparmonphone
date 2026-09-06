'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useCart } from '@/store/cart';
import { formatPrice } from '@/lib/format';

type ScreenProtectorSuggestion = {
  id: string;
  slug: string;
  title: string;
  price: number;
  imageUrl: string | null;
};

export default function AddToCartButton({
  product,
  disabled,
  screenProtector,
}: {
  product: { productId: string; slug: string; title: string; price: number; imageUrl: string | null };
  disabled?: boolean;
  // Renseigné uniquement quand ce produit est un écran ET qu'un verre trempé du même modèle exact
  // existe (voir src/lib/screenProtectorSuggestion.ts) — sert à proposer la vente additionnelle juste
  // après l'ajout au panier.
  screenProtector?: ScreenProtectorSuggestion | null;
}) {
  const addItem = useCart((s) => s.addItem);
  const [added, setAdded] = useState(false);
  const [showUpsell, setShowUpsell] = useState(false);
  const [protectorAdded, setProtectorAdded] = useState(false);

  return (
    <div className="relative">
      <button
        disabled={disabled}
        onClick={() => {
          addItem(product);
          setAdded(true);
          setTimeout(() => setAdded(false), 1500);
          if (screenProtector) setShowUpsell(true);
        }}
        className="w-full md:w-auto bg-brand text-white px-8 py-3 rounded-lg font-semibold hover:bg-brand-dark transition disabled:bg-gray-300 disabled:cursor-not-allowed"
      >
        {disabled ? 'Indisponible' : added ? '✅ Ajouté au panier' : '🛒 Ajouter au panier'}
      </button>

      {showUpsell && screenProtector && (
        <div className="mt-3 border border-brand/30 bg-brand-light/30 rounded-xl p-3 flex items-center gap-3">
          {screenProtector.imageUrl && (
            <Image
              src={screenProtector.imageUrl}
              alt=""
              width={48}
              height={48}
              className="rounded-lg object-cover shrink-0 bg-white"
            />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-700">
              Pensez à protéger votre écran :
              <span className="font-medium"> {screenProtector.title}</span>
              {' — '}
              {formatPrice(screenProtector.price)}
            </p>
          </div>
          {protectorAdded ? (
            <span className="text-sm font-medium text-green-700 shrink-0">✅ Ajouté</span>
          ) : (
            <button
              onClick={() => {
                addItem({
                  productId: screenProtector.id,
                  slug: screenProtector.slug,
                  title: screenProtector.title,
                  price: screenProtector.price,
                  imageUrl: screenProtector.imageUrl,
                });
                setProtectorAdded(true);
              }}
              className="text-sm font-semibold text-brand-dark border border-brand px-3 py-1.5 rounded-lg hover:bg-brand-light shrink-0"
            >
              Ajouter
            </button>
          )}
          <button
            onClick={() => setShowUpsell(false)}
            aria-label="Fermer"
            className="text-gray-400 hover:text-gray-600 shrink-0"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
