'use client';

import { useEffect, useRef } from 'react';
import AnimatedLogo from './AnimatedLogo';
import { formatDayLong, type VacationPayload } from '@/lib/vacationShared';

// Pop-up « Mode vacances » (affichage seul). Utilisé par le site public (VacationPopup.tsx) ET par l'aperçu
// privé de l'admin : c'est exactement le même rendu, donc ce que tu vois dans l'admin est ce que verront
// les visiteurs. Thème téléphone : « mode avion » + batterie du réparateur qui se recharge.

const CSS = `
.vac-overlay{animation:vac-fade .35s ease-out both}
.vac-card{animation:vac-pop .55s cubic-bezier(.2,1.2,.3,1) both}
.vac-rays{transform-box:fill-box;transform-origin:50% 50%;animation:vac-spin 40s linear infinite}
.vac-sun{animation:vac-pulse 4s ease-in-out infinite;transform-box:fill-box;transform-origin:50% 50%}
.vac-cloud-a{animation:vac-drift 38s linear infinite}
.vac-cloud-b{animation:vac-drift 55s linear infinite;animation-delay:-20s}
.vac-plane{animation:vac-fly 16s linear infinite}
.vac-palm{transform-box:fill-box;transform-origin:50% 100%;animation:vac-sway 5s ease-in-out infinite}
.vac-wave-1{animation:vac-wave 8s linear infinite}
.vac-wave-2{animation:vac-wave 5.5s linear infinite reverse}
.vac-logo{animation:vac-float 5s ease-in-out infinite}
.vac-fill-shine{position:absolute;inset:0;background:linear-gradient(100deg,transparent 30%,rgba(255,255,255,.55) 50%,transparent 70%);background-size:200% 100%;animation:vac-shine 2.2s linear infinite}
.vac-bolt{animation:vac-blink 1.4s ease-in-out infinite}
.vac-low{animation:vac-blink-low 1.1s ease-in-out infinite}
.vac-rise>*{animation:vac-rise .6s ease-out both}
.vac-rise>*:nth-child(1){animation-delay:.25s}.vac-rise>*:nth-child(2){animation-delay:.33s}.vac-rise>*:nth-child(3){animation-delay:.41s}
.vac-rise>*:nth-child(4){animation-delay:.49s}.vac-rise>*:nth-child(5){animation-delay:.57s}.vac-rise>*:nth-child(6){animation-delay:.65s}
.vac-rise>*:nth-child(7){animation-delay:.73s}
@keyframes vac-fade{from{opacity:0}to{opacity:1}}
@keyframes vac-pop{0%{opacity:0;transform:translateY(24px) scale(.92)}100%{opacity:1;transform:none}}
@keyframes vac-spin{to{transform:rotate(360deg)}}
@keyframes vac-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
@keyframes vac-drift{from{transform:translateX(-160px)}to{transform:translateX(680px)}}
@keyframes vac-fly{from{transform:translateX(-60px)}to{transform:translateX(600px)}}
@keyframes vac-sway{0%,100%{transform:rotate(-2.5deg)}50%{transform:rotate(2.5deg)}}
@keyframes vac-wave{from{transform:translateX(0)}to{transform:translateX(-520px)}}
@keyframes vac-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
@keyframes vac-shine{from{background-position:200% 0}to{background-position:-200% 0}}
@keyframes vac-blink{0%,100%{opacity:1}50%{opacity:.35}}
@keyframes vac-blink-low{0%,100%{opacity:1}50%{opacity:.55}}
@keyframes vac-rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion: reduce){
  .vac-overlay,.vac-card,.vac-rays,.vac-sun,.vac-cloud-a,.vac-cloud-b,.vac-plane,.vac-palm,.vac-wave-1,.vac-wave-2,.vac-logo,.vac-fill-shine,.vac-bolt,.vac-low,.vac-rise>*{animation:none!important}
}
`;

const WAVE =
  'M0 150 Q 32 138 65 150 T 130 150 T 195 150 T 260 150 T 325 150 T 390 150 T 455 150 T 520 150 T 585 150 T 650 150 T 715 150 T 780 150 T 845 150 T 910 150 T 975 150 T 1040 150 V190 H0 Z';

function Scene() {
  const rays = Array.from({ length: 12 }, (_, i) => i * 30);
  return (
    <svg viewBox="0 0 520 190" preserveAspectRatio="xMidYMid slice" className="block w-full h-[150px] sm:h-[165px]" aria-hidden="true">
      <defs>
        <linearGradient id="vacSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3FA7F3" />
          <stop offset="1" stopColor="#D6ECFB" />
        </linearGradient>
        <radialGradient id="vacSun">
          <stop offset="0" stopColor="#FFF6BF" />
          <stop offset="1" stopColor="#FFC83A" />
        </radialGradient>
      </defs>
      <rect width="520" height="190" fill="url(#vacSky)" />

      <g className="vac-sun">
        <g className="vac-rays">
          {rays.map((a) => (
            <line key={a} x1="410" y1="26" x2="410" y2="14" stroke="#FFD84D" strokeWidth="4" strokeLinecap="round" transform={`rotate(${a} 410 62)`} />
          ))}
        </g>
        <circle cx="410" cy="62" r="26" fill="url(#vacSun)" />
      </g>

      <g className="vac-cloud-a" opacity="0.95">
        <ellipse cx="40" cy="50" rx="26" ry="10" fill="#fff" />
        <ellipse cx="58" cy="42" rx="18" ry="12" fill="#fff" />
        <ellipse cx="26" cy="44" rx="14" ry="9" fill="#fff" />
      </g>
      <g className="vac-cloud-b" opacity="0.8">
        <ellipse cx="0" cy="92" rx="30" ry="10" fill="#fff" />
        <ellipse cx="20" cy="84" rx="20" ry="12" fill="#fff" />
      </g>

      <text className="vac-plane" x="0" y="34" fontSize="20">✈️</text>

      <path d="M0 190 V152 Q70 130 150 148 Q205 160 235 190 Z" fill="#F6DFA9" />
      <path d="M0 190 V170 Q60 158 120 172 Q170 182 200 190 Z" fill="#EBCB86" opacity="0.7" />

      <g className="vac-palm">
        <path d="M74 174 C 80 142, 88 112, 98 90 L 106 93 C 98 116, 92 142, 90 174 Z" fill="#8B5A2B" />
        <path d="M102 92 C 78 66, 46 70, 24 92 C 52 82, 80 84, 102 92 Z" fill="#1FA34A" />
        <path d="M102 92 C 96 62, 70 42, 40 44 C 66 54, 84 68, 102 92 Z" fill="#168A3E" />
        <path d="M102 92 C 112 58, 138 42, 168 48 C 142 56, 122 70, 102 92 Z" fill="#1FA34A" />
        <path d="M102 92 C 126 74, 160 76, 180 98 C 152 90, 126 88, 102 92 Z" fill="#168A3E" />
        <path d="M102 92 C 100 70, 104 52, 112 36 C 114 58, 110 76, 102 92 Z" fill="#1FA34A" />
        <circle cx="99" cy="99" r="4.2" fill="#6B4423" />
        <circle cx="108" cy="100" r="4.2" fill="#6B4423" />
      </g>

      <g className="vac-wave-2">
        <path d={WAVE} fill="#0B5FA5" opacity="0.85" transform="translate(0 12)" />
      </g>
      <g className="vac-wave-1">
        <path d={WAVE} fill="#0E7FDB" opacity="0.9" transform="translate(-130 4)" />
      </g>
    </svg>
  );
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function dayWord(n: number) {
  return n <= 1 ? `${n} jour` : `${n} jours`;
}

export default function VacationPopupView({
  data,
  onClose,
  preview = false,
}: {
  data: VacationPayload;
  onClose: () => void;
  preview?: boolean;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const during = data.phase === 'during';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const countdown = during
    ? data.daysLeft <= 0
      ? 'Retour aujourd’hui'
      : data.daysLeft === 1
        ? 'Retour demain'
        : `Retour dans ${dayWord(data.daysLeft)}`
    : data.daysLeft <= 0
      ? 'Départ aujourd’hui'
      : data.daysLeft === 1
        ? 'Départ demain'
        : `Départ dans ${dayWord(data.daysLeft)}`;

  const low = data.percent < 20;
  const battColor = low ? '#EF4444' : data.percent < 50 ? '#F59E0B' : '#22C55E';

  return (
    <div
      className="vac-overlay fixed inset-0 z-[70] flex flex-col items-center justify-center gap-3 p-3 sm:p-6 bg-slate-900/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <style>{CSS}</style>

      {preview && (
        <div className="shrink-0 bg-amber-400 text-amber-950 text-xs sm:text-sm font-semibold px-4 py-2 rounded-full shadow-lg text-center max-w-[92vw]">
          👁️ Aperçu privé — les visiteurs ne voient rien tant que le mode vacances n&apos;est pas actif
        </div>
      )}

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="vac-title"
        className={`vac-card relative w-full max-w-[560px] overflow-y-auto rounded-3xl bg-white shadow-2xl ${preview ? 'max-h-[calc(100vh-96px)]' : 'max-h-[94vh]'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative overflow-hidden rounded-t-3xl">
          <Scene />
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="absolute top-3 right-3 h-9 w-9 rounded-full bg-white/90 text-gray-700 text-lg leading-none shadow hover:bg-white transition"
          >
            ✕
          </button>
        </div>

        <div className="relative -mt-12 flex justify-center">
          <div className="vac-logo h-[118px] w-[118px] rounded-[26px] bg-white shadow-xl ring-4 ring-white flex items-center justify-center">
            <AnimatedLogo size={112} />
          </div>
        </div>

        <div className="vac-rise px-5 sm:px-8 pt-3 pb-6 text-center">
          <span className="inline-block rounded-full bg-brand-light text-brand-dark text-[11px] font-bold uppercase tracking-wider px-3 py-1">
            {during ? '🌴 ReparMonPhone est en vacances' : '🌴 Petite pause en approche'}
          </span>

          <h2 id="vac-title" className="mt-2.5 text-[26px] sm:text-[28px] font-extrabold text-gray-900 leading-tight">
            {data.title}
            {during && <span className="ml-1.5">✈️</span>}
          </h2>

          <p className="mt-2 text-[14.5px] leading-relaxed text-gray-600">{data.message}</p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 text-left">
            <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Départ</p>
                  <p className="text-[13px] font-bold leading-snug text-gray-800">{cap(formatDayLong(data.start))}</p>
                </div>
                <span className="text-brand text-lg" aria-hidden="true">→</span>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Retour</p>
                  <p className="text-[13px] font-bold leading-snug text-gray-800">{cap(formatDayLong(data.returnDate))}</p>
                </div>
              </div>
              <p className="mt-2 border-t border-gray-200 pt-2 text-center text-sm font-bold text-brand-dark">{countdown}</p>
            </div>

            <div className="rounded-2xl border border-gray-100 px-4 py-3">
              <p className="text-xs font-semibold text-gray-700">Batterie du réparateur</p>
              <div className="mt-2 flex items-center">
                <div className="relative h-7 flex-1 rounded-lg border-2 border-gray-300 bg-white overflow-hidden">
                  <div className="relative h-full rounded-[5px] transition-all" style={{ width: `${data.percent}%`, background: battColor }}>
                    <span className="vac-fill-shine" />
                  </div>
                  {during && (
                    <span className="vac-bolt absolute inset-0 flex items-center justify-center text-sm" aria-hidden="true">⚡</span>
                  )}
                </div>
                <span className="h-3 w-1.5 rounded-r-sm bg-gray-300" aria-hidden="true" />
              </div>
              <p className={`mt-2 text-xs font-bold ${low ? 'vac-low text-red-500' : 'text-gray-700'}`}>
                {data.percent} % {during ? '· en charge…' : '· recharge imminente'}
              </p>
            </div>
          </div>

          {data.orderInfo && (
            <p className="mt-3 rounded-xl bg-brand-light px-4 py-2.5 text-left text-[13px] leading-relaxed text-brand-dark">
              ℹ️ {data.orderInfo}
            </p>
          )}

          {data.showContact && (
            <p className="mt-2.5 text-xs text-gray-500">
              Une question ? Écrivez-nous à{' '}
              <a
                href="mailto:contact@reparmonphone.fr"
                className="font-semibold text-brand hover:underline"
                onClick={preview ? (e) => e.preventDefault() : undefined}
              >
                contact@reparmonphone.fr
              </a>{' '}
              — nous répondons à notre retour.
            </p>
          )}

          <button
            type="button"
            onClick={onClose}
            className="mt-4 w-full rounded-xl bg-brand py-3.5 text-[15px] font-bold text-white shadow-lg shadow-brand/30 transition hover:bg-brand-dark active:scale-[.99]"
          >
            Continuer vers le site
          </button>
        </div>
      </div>
    </div>
  );
}
