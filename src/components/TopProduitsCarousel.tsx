'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { formatPrice } from '@/lib/format';
import ProductStars from './ProductStars';

export type CarouselProduct = {
  id: string;
  slug: string;
  title: string;
  price: number;
  regularPrice: number | null;
  imageUrl: string | null;
  avgRating: number | null;
  reviewCount: number;
  brandName: string;
};

type Tab = 'nouveautes' | 'vedette' | 'promos';

const TABS: { key: Tab; label: string }[] = [
  { key: 'nouveautes', label: 'Nouveautés' },
  { key: 'vedette', label: 'En Vedette' },
  { key: 'promos', label: 'Offres Spéciales' },
];

export default function TopProduitsCarousel({
  nouveautes,
  vedette,
  promos,
}: {
  nouveautes: CarouselProduct[];
  vedette: CarouselProduct[];
  promos: CarouselProduct[];
}) {
  const [tab, setTab] = useState<Tab>('nouveautes');
  const scrollerRef = useRef<HTMLDivElement>(null);

  const data = { nouveautes, vedette, promos }[tab];

  function scrollBy(dir: 1 | -1) {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * (el.clientWidth / 5), behavior: 'smooth' });
  }

  // Défilement automatique en boucle, 1 carte à la fois (~5 visibles par ligne)
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ left: 0 });

    const timer = setInterval(() => {
      if (!el) return;
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
      if (atEnd) {
        el.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        el.scrollBy({ left: el.clientWidth / 5, behavior: 'smooth' });
      }
    }, 2800);

    return () => clearInterval(timer);
  }, [tab]);

  return (
    <section className="max-w-6xl mx-auto px-4 py-12">
      <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900">TOP Produits</h2>
          <p className="text-gray-500 mt-1">Parcourez la collection de nos produits les plus vendus et les plus intéressants.</p>
        </div>
        <div className="flex gap-1 text-sm">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                tab === t.key ? 'bg-brand text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {data.length === 0 ? (
        <p className="text-gray-500 text-sm">Rien à afficher pour le moment dans cette catégorie.</p>
      ) : (
        <div className="relative">
          <div ref={scrollerRef} className="flex gap-4 overflow-x-auto scroll-smooth pb-2 snap-x snap-mandatory scrollbar-hide">
            {data.map((p) => (
              <Link
                key={p.id}
                href={`/produit/${p.slug}`}
                className="snap-start shrink-0 w-[calc(20%-13px)] min-w-[160px] bg-white border border-gray-100 rounded-xl p-3 hover:shadow-md transition"
              >
                <div className="relative aspect-square bg-gray-50 rounded-lg overflow-hidden mb-2">
                  {p.imageUrl ? (
                    <Image src={p.imageUrl} alt={p.title} fill className="object-contain p-3" sizes="220px" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl text-gray-300">📱</div>
                  )}
                </div>
                <p className="text-xs text-gray-400">{p.brandName}</p>
                <p className="text-sm text-gray-800 line-clamp-2 mb-1 min-h-[2.5em]">{p.title}</p>
                <ProductStars rating={p.avgRating} count={p.reviewCount} size="text-xs" />
                <div className="flex items-center gap-2">
                  <span className="text-brand-dark font-bold">{formatPrice(p.price)}</span>
                  {p.regularPrice && p.regularPrice > p.price && (
                    <span className="text-gray-400 text-xs line-through">{formatPrice(p.regularPrice)}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>

          <button
            onClick={() => scrollBy(-1)}
            aria-label="Précédent"
            className="hidden md:flex absolute -left-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white border border-gray-200 shadow items-center justify-center hover:bg-gray-50"
          >
            ‹
          </button>
          <button
            onClick={() => scrollBy(1)}
            aria-label="Suivant"
            className="hidden md:flex absolute -right-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white border border-gray-200 shadow items-center justify-center hover:bg-gray-50"
          >
            ›
          </button>
        </div>
      )}
    </section>
  );
}
