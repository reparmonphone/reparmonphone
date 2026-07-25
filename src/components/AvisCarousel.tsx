'use client';

import { useRef } from 'react';

type ReviewItem = { id: string; author: string; rating: number | null; text: string };

function Stars({ rating }: { rating: number }) {
  return (
    <div className="text-amber-400 text-sm">
      {'★'.repeat(rating)}
      <span className="text-gray-200">{'★'.repeat(5 - rating)}</span>
    </div>
  );
}

export default function AvisCarousel({
  title,
  reviews,
}: {
  title: string;
  badgeColor: string;
  reviews: ReviewItem[];
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  function scrollBy(dir: 1 | -1) {
    scrollerRef.current?.scrollBy({ left: dir * 300, behavior: 'smooth' });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-800">{title}</h3>
        <div className="flex gap-2">
          <button
            onClick={() => scrollBy(-1)}
            aria-label="Avis précédents"
            className="w-8 h-8 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center hover:bg-gray-50"
          >
            ‹
          </button>
          <button
            onClick={() => scrollBy(1)}
            aria-label="Avis suivants"
            className="w-8 h-8 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center hover:bg-gray-50"
          >
            ›
          </button>
        </div>
      </div>

      <div ref={scrollerRef} className="flex gap-4 overflow-x-auto scroll-smooth pb-2 snap-x snap-mandatory scrollbar-hide">
        {reviews.map((r) => (
          <div
            key={r.id}
            className="snap-start shrink-0 w-[280px] bg-white border border-gray-100 rounded-xl p-5"
          >
            <p className="font-semibold text-sm text-gray-800">{r.author}</p>
            {r.rating ? <Stars rating={r.rating} /> : <p className="text-xs text-gray-400 mt-0.5">📌 recommande</p>}
            <p className="text-sm text-gray-600 mt-2 leading-relaxed">{r.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
