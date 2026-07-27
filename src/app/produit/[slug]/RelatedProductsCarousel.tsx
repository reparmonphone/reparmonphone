'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { formatPrice } from '@/lib/format';
import ProductStars from '@/components/ProductStars';

type RelatedProduct = {
  id: string;
  slug: string;
  title: string;
  price: number;
  imageUrl: string | null;
  inStock: boolean;
  avgRating: number | null;
  reviewCount: number;
};

export default function RelatedProductsCarousel({ products }: { products: RelatedProduct[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (products.length <= 4) return;
    const el = scrollerRef.current;
    if (!el) return;
    const timer = setInterval(() => {
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
      if (atEnd) el.scrollTo({ left: 0, behavior: 'smooth' });
      else el.scrollBy({ left: el.clientWidth / 4, behavior: 'smooth' });
    }, 3000);
    return () => clearInterval(timer);
  }, [products.length]);

  return (
    <div ref={scrollerRef} className="flex gap-4 overflow-x-auto scroll-smooth pb-2 snap-x snap-mandatory scrollbar-hide">
      {products.map((p) => (
        <Link
          key={p.id}
          href={`/produit/${p.slug}`}
          className="snap-start shrink-0 w-[calc(25%-12px)] min-w-[160px] bg-white border border-gray-100 rounded-xl p-3 hover:shadow-md transition"
        >
          <div className="relative aspect-square bg-gray-50 rounded-lg overflow-hidden mb-2">
            {p.imageUrl ? (
              <Image src={p.imageUrl} alt={p.title} fill className="object-contain p-3" sizes="220px" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl text-gray-300">📱</div>
            )}
            {!p.inStock && (
              <span className="absolute top-2 left-2 bg-gray-800 text-white text-xs px-2 py-1 rounded">Rupture</span>
            )}
          </div>
          <p className="text-sm text-gray-800 line-clamp-2 mb-1 min-h-[2.5em]">{p.title}</p>
          <ProductStars rating={p.avgRating} count={p.reviewCount} size="text-xs" />
          <span className="text-brand-dark font-bold">{formatPrice(p.price)}</span>
        </Link>
      ))}
    </div>
  );
}
