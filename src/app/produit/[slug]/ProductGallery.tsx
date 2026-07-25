'use client';

import { useState } from 'react';
import Image from 'next/image';

export default function ProductGallery({ images, title }: { images: string[]; title: string }) {
  const [active, setActive] = useState(0);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });
  const [zooming, setZooming] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  if (images.length === 0) {
    return (
      <div className="relative aspect-square bg-white rounded-xl border border-gray-100 flex items-center justify-center text-6xl text-gray-200">
        📱
      </div>
    );
  }

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoomPos({ x, y });
  }

  return (
    <div>
      <div
        className="relative aspect-square bg-white rounded-xl border border-gray-100 overflow-hidden cursor-zoom-in"
        onMouseEnter={() => setZooming(true)}
        onMouseLeave={() => setZooming(false)}
        onMouseMove={handleMouseMove}
        onClick={() => setLightboxOpen(true)}
      >
        <Image src={images[active]} alt={title} fill className="object-contain p-8" priority />

        {/* Zoom au survol (desktop) : agrandissement centré sur la position du curseur */}
        {zooming && (
          <div
            className="hidden md:block absolute inset-0 bg-no-repeat pointer-events-none"
            style={{
              backgroundImage: `url(${images[active]})`,
              backgroundSize: '220%',
              backgroundPosition: `${zoomPos.x}% ${zoomPos.y}%`,
            }}
          />
        )}

        <span className="absolute bottom-3 right-3 bg-white/90 text-gray-600 text-xs px-2 py-1 rounded-full pointer-events-none">
          🔍 Cliquer pour zoomer
        </span>
      </div>

      {images.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {images.map((img, i) => (
            <button
              key={img}
              onClick={() => setActive(i)}
              className={`relative w-16 h-16 shrink-0 rounded-lg border-2 bg-white ${
                i === active ? 'border-brand' : 'border-gray-100'
              }`}
            >
              <Image src={img} alt={`${title} ${i + 1}`} fill className="object-contain p-1" />
            </button>
          ))}
        </div>
      )}

      {/* Lightbox plein écran (mobile + clic desktop) */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 text-white text-2xl w-10 h-10 flex items-center justify-center"
            aria-label="Fermer"
          >
            ✕
          </button>
          <div className="relative w-full max-w-3xl aspect-square">
            <Image src={images[active]} alt={title} fill className="object-contain" />
          </div>
          {images.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setActive((i) => (i - 1 + images.length) % images.length); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white text-3xl w-10 h-10 flex items-center justify-center"
              >
                ‹
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setActive((i) => (i + 1) % images.length); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white text-3xl w-10 h-10 flex items-center justify-center"
              >
                ›
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
