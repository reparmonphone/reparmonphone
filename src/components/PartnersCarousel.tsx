'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';

export type PartnerData = { id: string; name: string; logoUrl: string | null; linkUrl: string };

const SCROLL_STEP = 170; // largeur d'une carte (150px) + l'espacement (gap-4 = 16px), arrondi

export default function PartnersCarousel({ partners }: { partners: PartnerData[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Défilement automatique en boucle, comme les autres carrousels du site (nouveautés, avis...).
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || partners.length <= 3) return;

    const timer = setInterval(() => {
      if (!el) return;
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
      if (atEnd) {
        el.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        el.scrollBy({ left: SCROLL_STEP, behavior: 'smooth' });
      }
    }, 2500);

    return () => clearInterval(timer);
  }, [partners.length]);

  function scrollByAmount(amount: number) {
    scrollerRef.current?.scrollBy({ left: amount, behavior: 'smooth' });
  }

  return (
    <div className="relative">
      <div
        ref={scrollerRef}
        className="flex flex-nowrap justify-start sm:justify-center items-center gap-4 overflow-x-auto scroll-smooth pb-2 scrollbar-hide"
      >
        {partners.map((p) => (
          <a
            key={p.id}
            href={p.linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 w-[150px] h-[150px] bg-white border border-gray-100 rounded-xl p-4 flex items-center justify-center hover:shadow-md transition"
          >
            {p.logoUrl ? (
              <div className="relative w-full h-full">
                <Image src={p.logoUrl} alt={p.name} fill className="object-contain" sizes="150px" />
              </div>
            ) : (
              <span className="font-extrabold text-gray-800 text-sm text-center">{p.name}</span>
            )}
          </a>
        ))}
      </div>

      {partners.length > 3 && (
        <>
          <button
            type="button"
            onClick={() => scrollByAmount(-SCROLL_STEP * 2)}
            aria-label="Précédent"
            className="hidden sm:flex absolute -left-4 top-1/2 -translate-y-1/2 w-8 h-8 items-center justify-center bg-white border border-gray-200 rounded-full shadow text-gray-500 hover:text-brand hover:shadow-md transition"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => scrollByAmount(SCROLL_STEP * 2)}
            aria-label="Suivant"
            className="hidden sm:flex absolute -right-4 top-1/2 -translate-y-1/2 w-8 h-8 items-center justify-center bg-white border border-gray-200 rounded-full shadow text-gray-500 hover:text-brand hover:shadow-md transition"
          >
            ›
          </button>
        </>
      )}
    </div>
  );
}
