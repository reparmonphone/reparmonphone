'use client';

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';

type Slide = {
  src: string;
  alt: string;
  href: string;
};

const SLIDES: Slide[] = [
  {
    src: '/slider/slide-chronopost.png',
    alt: 'Livraison Chronopost 24h dès 250€ HT, commande avant 20h',
    href: '/boutique',
  },
  {
    src: '/slider/slide-newlife-xiaomi.png',
    alt: 'NewLife — téléphones reconditionnés par Xiaomi, stock limité',
    href: '/boutique?marque=xiaomi',
  },
  {
    src: '/slider/slide-optimum.png',
    alt: 'Gamme Optimum — écrans qualité pour Samsung Galaxy et Google Pixel',
    href: '/boutique?type=ECRAN',
  },
];

export default function HeroSlider() {
  const [index, setIndex] = useState(0);

  const next = useCallback(() => setIndex((i) => (i + 1) % SLIDES.length), []);
  const prev = useCallback(() => setIndex((i) => (i - 1 + SLIDES.length) % SLIDES.length), []);

  useEffect(() => {
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [next]);

  return (
    <div className="relative w-full aspect-[1512/797] max-h-[70vh] overflow-hidden bg-gray-900">
      {SLIDES.map((slide, i) => (
        <Link
          key={slide.src}
          href={slide.href}
          className={`absolute inset-0 transition-opacity duration-700 ${
            i === index ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
          }`}
        >
          <Image
            src={slide.src}
            alt={slide.alt}
            fill
            priority={i === 0}
            className="object-cover"
            sizes="100vw"
          />
        </Link>
      ))}

      {/* Flèches */}
      <button
        onClick={prev}
        aria-label="Slide précédente"
        className="absolute left-3 top-1/2 -translate-y-1/2 z-20 bg-white/80 hover:bg-white text-gray-800 w-9 h-9 rounded-full flex items-center justify-center shadow"
      >
        ‹
      </button>
      <button
        onClick={next}
        aria-label="Slide suivante"
        className="absolute right-3 top-1/2 -translate-y-1/2 z-20 bg-white/80 hover:bg-white text-gray-800 w-9 h-9 rounded-full flex items-center justify-center shadow"
      >
        ›
      </button>

      {/* Puces */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-2">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => setIndex(i)}
            aria-label={`Aller à la slide ${i + 1}`}
            className={`w-2.5 h-2.5 rounded-full transition ${i === index ? 'bg-white' : 'bg-white/50'}`}
          />
        ))}
      </div>
    </div>
  );
}
