'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useCart } from '@/store/cart';
import { formatPrice } from '@/lib/format';
import { trackAddToCart } from '@/lib/gtmEvents';
import { flyToCart } from '@/lib/cartFx';
import type { ToolKitItem } from '@/lib/toolKit';

// « Vous voulez la poser vous-même ? » : le guide de réparation + les outils nécessaires, ajoutables
// au panier en un clic (cochés par défaut, on peut en décocher).
export default function ToolKitUpsell({
  tools,
  guide,
}: {
  tools: ToolKitItem[];
  guide: { slug: string; title: string } | null;
}) {
  const addItem = useCart((s) => s.addItem);
  const [selected, setSelected] = useState<string[]>(tools.map((t) => t.id));
  const [done, setDone] = useState(false);

  const chosen = tools.filter((t) => selected.includes(t.id));
  const total = chosen.reduce((sum, t) => sum + t.price, 0);

  function toggle(id: string) {
    setDone(false);
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  function addKit(e: React.MouseEvent<HTMLButtonElement>) {
    if (chosen.length === 0) return;
    flyToCart(e.currentTarget, chosen[0].imageUrl);
    for (const t of chosen) {
      addItem({ productId: t.id, slug: t.slug, title: t.title, price: t.price, imageUrl: t.imageUrl });
      trackAddToCart({ item_id: t.id, item_name: t.title, price: t.price, quantity: 1 });
    }
    setDone(true);
  }

  return (
    <section className="mt-4 rounded-xl border border-brand/25 bg-white p-4" aria-label="Kit outils pour poser la pièce">
      <h2 className="text-sm font-bold text-gray-900">🧰 Vous voulez la poser vous-même ?</h2>
      <p className="mt-1 text-xs text-gray-500">
        Les outils dont vous aurez besoin
        {guide && (
          <>
            {' '}
            (voir le guide{' '}
            <Link href={`/reparation/guide/${guide.slug}`} className="text-brand hover:underline">
              {guide.title}
            </Link>
            )
          </>
        )}
        .
      </p>

      <ul className="mt-3 space-y-2">
        {tools.map((t) => (
          <li key={t.id}>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-100 px-3 py-2 hover:bg-gray-50">
              <input
                type="checkbox"
                checked={selected.includes(t.id)}
                onChange={() => toggle(t.id)}
                className="h-4 w-4 accent-brand"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-gray-800">{t.title}</span>
                <span className="block text-xs text-gray-400">{t.forTool}</span>
              </span>
              <span className="shrink-0 text-sm font-semibold text-gray-700">{formatPrice(t.price)}</span>
            </label>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={addKit}
        disabled={chosen.length === 0}
        className={`mt-3 w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-gray-300 ${
          done ? 'bg-green-600' : 'bg-brand hover:bg-brand-dark'
        }`}
      >
        {done
          ? '✅ Kit ajouté au panier'
          : chosen.length === 0
          ? 'Cochez au moins un outil'
          : `Ajouter ${chosen.length > 1 ? `les ${chosen.length} outils` : "l'outil"} au panier · ${formatPrice(total)}`}
      </button>
    </section>
  );
}
