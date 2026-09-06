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
  screenProtectors,
}: {
  product: { productId: string; slug: string; title: string; price: number; imageUrl: string | null };
  disabled?: boolean;
  // Renseigné uniquement quand ce produit est un écran ET qu'au moins un verre trempé du même modèle
  // exact existe (voir src/lib/screenProtectorSuggestion.ts) — jusqu'à 3 choix (unité(s) d'abord, lots
  // ensuite) pour la vente additionnelle proposée juste après l'ajout au panier.
  screenProtectors?: ScreenProtectorSuggestion[];
}) {
  const addItem = useCart((s) => s.addItem);
  const [added, setAdded] = useState(false);
  const [showUpsell, setShowUpsell] = useState(false);
  const [addedProtectorIds, setAddedProtectorIds] = useState<string[]>([]);

  const hasSuggestions = !!screenProtectors && screenProtectors.length > 0;

  return (
    <div className="relative">
      <button
        disabled={disabled}
        onClick={() => {
          addItem(product);
          setAdded(true);
          setTimeout(() => setAdded(false), 1500);
          if (hasSuggestions) setShowUpsell(true);
        }}
        className="w-full md:w-auto bg-brand text-white px-8 py-3 rounded-lg font-semibold hover:bg-brand-dark transition disabled:bg-gray-300 disabled:cursor-not-allowed"
      >
        {disabled ? 'Indisponible' : added ? '✅ Ajouté au panier' : '🛒 Ajouter au panier'}
      </button>

      {showUpsell && hasSuggestions && (
        <div className="mt-3 border border-brand/30 bg-brand-light/30 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-700 font-medium">Pensez à protéger votre écran :</p>
            <button
              onClick={() => setShowUpsell(false)}
              aria-label="Fermer"
              className="text-gray-400 hover:text-gray-600 shrink-0"
            >
              ✕
            </button>
          </div>

          <div className="space-y-2">
            {screenProtectors!.map((protector) => {
              const isAdded = addedProtectorIds.includes(protector.id);
              return (
                <div key={protector.id} className="flex items-center gap-3 bg-white rounded-lg p-2">
                  {protector.imageUrl && (
                    <Image
                      src={protector.imageUrl}
                      alt=""
                      width={40}
                      height={40}
                      className="rounded-lg object-cover shrink-0 bg-gray-50"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 truncate">{protector.title}</p>
                    <p className="text-xs text-gray-400">{formatPrice(protector.price)}</p>
                  </div>
                  {isAdded ? (
                    <span className="text-sm font-medium text-green-700 shrink-0">✅ Ajouté</span>
                  ) : (
                    <button
                      onClick={() => {
                        addItem({
                          productId: protector.id,
                          slug: protector.slug,
                          title: protector.title,
                          price: protector.price,
                          imageUrl: protector.imageUrl,
                        });
                        setAddedProtectorIds((ids) => [...ids, protector.id]);
                      }}
                      className="text-sm font-semibold text-brand-dark border border-brand px-3 py-1.5 rounded-lg hover:bg-brand-light shrink-0"
                    >
                      Ajouter
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
