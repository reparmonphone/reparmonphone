'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';

export type ReviewItem = {
  id: string;
  author: string;
  authorPhotoUrl: string | null;
  rating: number | null;
  text: string;
  reviewDate: string | null; // ISO string
  verified: boolean;
};

function Stars({ rating, size = 'text-sm', color = 'text-amber-400' }: { rating: number; size?: string; color?: string }) {
  return (
    <div className={`${color} ${size}`}>
      {'★'.repeat(Math.round(rating))}
      <span className="text-gray-200">{'★'.repeat(5 - Math.round(rating))}</span>
    </div>
  );
}

function timeAgo(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diffMs / 86_400_000);
  if (days < 1) return "aujourd'hui";
  if (days === 1) return 'il y a 1 jour';
  if (days < 7) return `il y a ${days} jours`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return 'il y a 1 semaine';
  if (weeks < 5) return `il y a ${weeks} semaines`;
  const months = Math.floor(days / 30);
  if (months < 1) return 'il y a 1 mois';
  if (months < 12) return `il y a ${months} mois`;
  const years = Math.floor(days / 365);
  return years <= 1 ? 'il y a 1 an' : `il y a ${years} ans`;
}

function Avatar({ name, photoUrl }: { name: string; photoUrl: string | null }) {
  if (photoUrl) {
    return (
      <div className="relative w-10 h-10 rounded-full overflow-hidden shrink-0">
        <Image src={photoUrl} alt={name} fill className="object-cover" unoptimized />
      </div>
    );
  }
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <div className="w-10 h-10 rounded-full bg-brand-light text-brand-dark flex items-center justify-center font-bold text-sm shrink-0">
      {initials}
    </div>
  );
}

function ReviewCard({ review, sourceIcon, starColor }: { review: ReviewItem; sourceIcon: React.ReactNode; starColor: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = review.text.length > 140;
  const displayText = expanded || !isLong ? review.text : `${review.text.slice(0, 140)}…`;
  const ago = timeAgo(review.reviewDate);

  return (
    <div className="snap-start shrink-0 w-[300px] bg-white border border-gray-100 rounded-xl p-5 relative">
      <span className="absolute top-4 right-4">{sourceIcon}</span>
      <div className="flex items-center gap-3 mb-2">
        <Avatar name={review.author} photoUrl={review.authorPhotoUrl} />
        <div>
          <p className="font-semibold text-sm text-gray-800">{review.author}</p>
          {ago && <p className="text-xs text-gray-400">{ago}</p>}
        </div>
      </div>
      <div className="flex items-center gap-1.5 mb-2">
        {review.rating ? <Stars rating={review.rating} color={starColor} /> : <span className="text-xs text-gray-500 flex items-center gap-1">👍 recommande</span>}
        {review.verified && <span className="text-blue-500 text-xs" title="Avis vérifié">✔️</span>}
      </div>
      <p className="text-sm text-gray-600 leading-relaxed">
        {displayText}
        {isLong && (
          <button onClick={() => setExpanded((v) => !v)} className="text-brand font-medium ml-1 hover:underline">
            {expanded ? 'Voir moins' : 'Lire la suite'}
          </button>
        )}
      </p>
    </div>
  );
}

export default function AvisCarousel({
  title,
  sourceIcon,
  sourceLogo,
  starColor = 'text-amber-400',
  average,
  total,
  reviews,
  mode = 'carousel',
  maxItems,
}: {
  title: string;
  sourceIcon: React.ReactNode;
  sourceLogo: React.ReactNode;
  starColor?: string;
  average: number | null;
  total: number | null;
  reviews: ReviewItem[];
  /** 'carousel' (défilement auto + flèches) ou 'grid' (grille statique, sans défilement) */
  mode?: 'carousel' | 'grid';
  /** Limite le nombre d'avis affichés (utile surtout en mode 'grid') */
  maxItems?: number;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const displayedReviews = maxItems ? reviews.slice(0, maxItems) : reviews;

  function scrollBy(dir: 1 | -1) {
    scrollerRef.current?.scrollBy({ left: dir * 316, behavior: 'smooth' });
  }

  useEffect(() => {
    if (mode !== 'carousel' || displayedReviews.length <= 1) return;
    const el = scrollerRef.current;
    if (!el) return;
    const timer = setInterval(() => {
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
      if (atEnd) el.scrollTo({ left: 0, behavior: 'smooth' });
      else el.scrollBy({ left: 316, behavior: 'smooth' });
    }, 3500);
    return () => clearInterval(timer);
  }, [mode, displayedReviews.length]);

  return (
    <div>
      {/* Résumé façon Trustindex */}
      <div className="text-center mb-6">
        <p className="text-xs font-bold tracking-wide text-gray-500 uppercase">
          {average && average >= 4 ? 'Excellent' : average && average >= 3 ? 'Très bien' : 'Avis clients'}
        </p>
        {average && <Stars rating={average} size="text-2xl" color={starColor} />}
        {total && (
          <p className="text-sm text-gray-500 mt-1">
            Basé sur <strong>{total}</strong> avis
          </p>
        )}
        <div className="mt-1 flex justify-center">{sourceLogo}</div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-gray-800 text-sm">{title}</h3>
        {mode === 'carousel' && (
          <div className="flex gap-2">
            <button onClick={() => scrollBy(-1)} aria-label="Avis précédents" className="w-8 h-8 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center hover:bg-gray-50">‹</button>
            <button onClick={() => scrollBy(1)} aria-label="Avis suivants" className="w-8 h-8 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center hover:bg-gray-50">›</button>
          </div>
        )}
      </div>

      {mode === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {displayedReviews.map((r) => (
            <ReviewCard key={r.id} review={r} sourceIcon={sourceIcon} starColor={starColor} />
          ))}
        </div>
      ) : (
        <div ref={scrollerRef} className="flex gap-4 overflow-x-auto scroll-smooth pb-2 snap-x snap-mandatory scrollbar-hide">
          {displayedReviews.map((r) => (
            <ReviewCard key={r.id} review={r} sourceIcon={sourceIcon} starColor={starColor} />
          ))}
        </div>
      )}
    </div>
  );
}
