'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { PromoPayload } from '@/lib/promoPopup';

const CSS = `
@keyframes pp-fade{from{opacity:0}to{opacity:1}}
@keyframes pp-pop{from{opacity:0;transform:translateY(24px) scale(.97)}to{opacity:1;transform:none}}
@keyframes pp-float{50%{transform:translateY(-6px)}}
@keyframes pp-shine{to{background-position:220% 0}}
.pp-overlay{animation:pp-fade .25s ease both}
.pp-card{animation:pp-pop .45s cubic-bezier(.2,.8,.2,1) both}
.pp-img{animation:pp-float 5s ease-in-out infinite}
.pp-cta{background-image:linear-gradient(110deg,#0E7FDB 0%,#0B5FA5 45%,#3aa8f0 55%,#0B5FA5 100%);background-size:220% 100%}
.pp-cta:hover{animation:pp-shine 1.4s linear infinite}
@media (prefers-reduced-motion:reduce){.pp-overlay,.pp-card,.pp-img,.pp-cta:hover{animation:none!important}}
`;

function split(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    d: Math.floor(total / 86400),
    h: Math.floor((total % 86400) / 3600),
    m: Math.floor((total % 3600) / 60),
    s: total % 60,
  };
}

// Compte à rebours : même échéance pour tous les visiteurs (aucun faux compteur qui repart à zéro).
function Countdown({ end, limitedText }: { end: number; limitedText: string }) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setLeft(end - Date.now());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [end]);

  if (left === null) return <div className="mt-3 h-[72px]" aria-hidden="true" />; // réserve la place avant le premier calcul
  if (left <= 0) {
    return <p className="mt-3 rounded-lg bg-gray-100 px-3 py-2 text-center text-sm font-semibold text-gray-600">Offre terminée</p>;
  }
  const t = split(left);
  const urgent = left < 24 * 3600 * 1000;
  const cells: [number, string][] = [
    ...(t.d > 0 ? ([[t.d, t.d > 1 ? 'jours' : 'jour']] as [number, string][]) : []),
    [t.h, 'h'],
    [t.m, 'min'],
    [t.s, 's'],
  ];
  return (
    <div className="mt-3">
      <p className={`text-[11px] font-bold uppercase tracking-wider ${urgent ? 'text-red-600' : 'text-brand-dark'}`}>
        ⏳ L’offre se termine dans
      </p>
      <div
        className="mt-1.5 flex justify-center gap-1.5 sm:justify-start"
        role="timer"
        aria-label={`Fin de l’offre dans ${t.d} jours, ${t.h} heures, ${t.m} minutes`}
      >
        {cells.map(([v, unit]) => (
          <div
            key={unit}
            className={`min-w-[3rem] rounded-lg px-2 py-1.5 text-center text-white shadow ${urgent ? 'bg-red-600' : 'bg-gray-900'}`}
          >
            <div className="text-lg font-extrabold leading-none tabular-nums">{String(v).padStart(2, '0')}</div>
            <div className="mt-0.5 text-[10px] uppercase tracking-wide opacity-80">{unit}</div>
          </div>
        ))}
      </div>
      {limitedText && <p className="mt-2 text-xs font-semibold text-gray-700">{limitedText}</p>}
    </div>
  );
}

// Vue du pop-up (utilisée par le site et par l'aperçu de l'admin).
// inline = affichage dans une page (aperçu), sans voile ni positionnement fixe.
export default function PromoPopupView({
  data,
  onClose,
  onCta,
  inline = false,
}: {
  data: PromoPayload;
  onClose?: () => void;
  onCta?: () => void;
  inline?: boolean;
}) {
  const card = (
    <div
      role={inline ? undefined : 'dialog'}
      aria-modal={inline ? undefined : true}
      aria-labelledby="promo-popup-title"
      className="pp-card relative w-full max-w-2xl overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
      onClick={(e) => e.stopPropagation()}
    >
      <style>{CSS}</style>
      <button
        type="button"
        onClick={onClose}
        aria-label="Fermer"
        className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-xl leading-none text-gray-500 shadow hover:text-gray-900"
      >
        ×
      </button>

      <div className="grid sm:grid-cols-[0.95fr_1.05fr]">
        <div className="relative flex items-center justify-center bg-gradient-to-br from-brand-light via-white to-brand-light px-6 py-5 sm:py-10">
          {data.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.imageUrl} alt={data.title} className="pp-img max-h-36 w-auto object-contain drop-shadow-xl sm:max-h-64" />
          ) : (
            <span className="text-6xl" aria-hidden="true">
              📱
            </span>
          )}
        </div>

        <div className="px-5 pb-5 pt-4 text-center sm:px-7 sm:py-8 sm:text-left">
          {data.badge && (
            <span className="inline-block rounded-full bg-brand-light px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-brand-dark">
              {data.badge}
            </span>
          )}
          <h2 id="promo-popup-title" className="mt-2 text-xl font-extrabold leading-tight text-gray-900 sm:text-2xl">
            {data.title}
          </h2>
          {data.text && <p className="mt-1.5 text-sm text-gray-600">{data.text}</p>}

          {data.bullets.length > 0 && (
            <ul className="mt-3 hidden space-y-1 text-left text-sm text-gray-700 sm:block">
              {data.bullets.map((b) => (
                <li key={b} className="flex gap-2">
                  <span className="text-green-600" aria-hidden="true">
                    ✓
                  </span>
                  {b}
                </li>
              ))}
            </ul>
          )}

          {data.countdownEnd ? <Countdown end={data.countdownEnd} limitedText={data.limitedText} /> : null}

          {(data.price || data.oldPrice) && (
            <p className="mt-3 flex items-baseline justify-center gap-2 sm:justify-start">
              {data.price && <span className="text-3xl font-extrabold text-brand-dark">{data.price}</span>}
              {data.oldPrice && <span className="text-sm text-gray-400 line-through">{data.oldPrice}</span>}
            </p>
          )}

          <div className="mt-4 flex flex-col items-center gap-2 sm:items-start">
            <Link
              href={data.ctaHref || '#'}
              onClick={onCta}
              className="pp-cta inline-flex w-full items-center justify-center rounded-xl px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5 sm:w-auto"
            >
              {data.ctaLabel} →
            </Link>
            <button type="button" onClick={onClose} className="text-xs text-gray-400 underline hover:text-gray-600">
              {data.dismissLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (inline) return card;

  return (
    <div
      className="pp-overlay fixed inset-0 z-[66] flex items-end justify-center bg-black/45 sm:items-center sm:p-6"
      onClick={onClose}
    >
      {card}
    </div>
  );
}
