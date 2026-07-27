'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { formatPrice } from '@/lib/format';
import ProductStars from './ProductStars';

export type NouveauteProduct = {
  id: string;
  slug: string;
  title: string;
  price: number;
  imageUrl: string | null;
  avgRating: number | null;
  reviewCount: number;
};

export default function NouveautesCarousel({ products }: { products: NouveauteProduct[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Défilement automatique, en boucle
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const timer = setInterval(() => {
      if (!el) return;
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
      if (atEnd) {
        el.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        el.scrollBy({ left: 240, behavior: 'smooth' });
      }
    }, 3000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div
      ref={scrollerRef}
      className="grid grid-flow-col grid-rows-2 auto-cols-[minmax(200px,1fr)] gap-4 overflow-x-auto scroll-smooth pb-2 scrollbar-hide"
      style={{ gridTemplateColumns: 'repeat(5, minmax(200px, 1fr))' }}
    >
      {products.map((p) => (
        <Link
          key={p.id}
          href={`/produit/${p.slug}`}
          className="group relative bg-white border border-gray-100 rounded-xl p-3 flex flex-col hover:shadow-md transition"
        >
          <span className="absolute top-2 left-2 z-10 bg-teal-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
            NEW
          </span>
          <div className="relative aspect-square bg-gray-50 rounded-lg overflow-hidden mb-2">
            {p.imageUrl ? (
              <Image src={p.imageUrl} alt={p.title} fill className="object-contain p-3 group-hover:scale-105 transition" sizes="200px" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl text-gray-300">📱</div>
            )}
          </div>
          <p className="text-xs text-gray-700 line-clamp-2 flex-1">{p.title}</p>
          <ProductStars rating={p.avgRating} count={p.reviewCount} size="text-xs" />
          <p className="text-brand-dark font-bold text-sm mt-1">{formatPrice(p.price)}</p>
        </Link>
      ))}
    </div>
  );
}
