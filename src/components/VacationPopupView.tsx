'use client';

import { useEffect, useRef, useState } from 'react';
import AnimatedLogo from './AnimatedLogo';
import { formatDayLong, type VacationPayload } from '@/lib/vacationShared';

// Pop-up « Mode vacances » (affichage seul). Utilisé par le site public (VacationPopup.tsx), par l'aperçu
// plein écran de l'admin ET par l'aperçu en direct intégré à la page de réglages : c'est exactement le même
// rendu, donc ce que tu vois dans l'admin est ce que verront les visiteurs.
// Visuel du haut : une vraie photo / vidéo si un fichier est renseigné dans l'admin (sinon animation intégrée :
// mer, reflets du soleil, palmier, mouettes).

const CSS = `
.vac-overlay{animation:vac-fade .35s ease-out both}
.vac-card{animation:vac-pop .55s cubic-bezier(.2,1.2,.3,1) both}
.vac-rays{transform-box:fill-box;transform-origin:50% 50%;animation:vac-spin 60s linear infinite}
.vac-glow{transform-box:fill-box;transform-origin:50% 50%;animation:vac-pulse 5s ease-in-out infinite}
.vac-cloud-a{animation:vac-drift 46s linear infinite}
.vac-cloud-b{animation:vac-drift 70s linear infinite;animation-delay:-28s}
.vac-bird{animation:vac-fly 22s linear infinite}
.vac-bird-2{animation-duration:30s;animation-delay:-11s}
.vac-bird path{animation:vac-flap .9s ease-in-out infinite;transform-box:fill-box;transform-origin:50% 100%}
.vac-palm{transform-origin:70px 194px;animation:vac-sway 7s ease-in-out infinite}
.vac-frond{transform-origin:114px 82px;animation:vac-frond 4.6s ease-in-out infinite}
.vac-wave-a{animation:vac-wave 14s linear infinite}
.vac-wave-b{animation:vac-wave 9s linear infinite reverse}
.vac-wave-c{animation:vac-wave 6s linear infinite}
.vac-glint{transform-box:fill-box;transform-origin:50% 50%;animation:vac-glint 2.4s ease-in-out infinite}
.vac-twinkle{animation:vac-twinkle 2.8s ease-in-out infinite}
.vac-foam{animation:vac-tide 6s ease-in-out infinite}
.vac-surf{animation:vac-surf 6s ease-in-out infinite}
.vac-kenburns{animation:vac-kb 18s ease-in-out infinite alternate;transform-origin:60% 50%}
.vac-logo{animation:vac-float 5s ease-in-out infinite}
.vac-fill{width:var(--p);animation:vac-charge 2.4s cubic-bezier(.22,.8,.3,1) .7s both,vac-batglow 2.2s ease-in-out 3.2s infinite}
.vac-stripes{background:repeating-linear-gradient(115deg,rgba(255,255,255,.32) 0 7px,transparent 7px 14px);background-size:28px 100%;animation:vac-stripes 1s linear infinite}
.vac-fill-shine{position:absolute;inset:0;background:linear-gradient(100deg,transparent 30%,rgba(255,255,255,.6) 50%,transparent 70%);background-size:200% 100%;animation:vac-shine 2s linear infinite}
.vac-bolt{animation:vac-bolt 1.2s ease-in-out infinite}
.vac-low{animation:vac-blink-low 1.1s ease-in-out infinite}
.vac-dots span{animation:vac-dot 1.2s ease-in-out infinite}
.vac-dots span:nth-child(2){animation-delay:.2s}.vac-dots span:nth-child(3){animation-delay:.4s}
.vac-orders{animation:vac-orders-glow 2.6s ease-in-out 1.2s infinite}
.vac-ping{animation:vac-ping 2.2s cubic-bezier(0,0,.2,1) infinite}
.vac-check{stroke-dasharray:24;stroke-dashoffset:24;animation:vac-draw .6s ease-out .9s forwards}
.vac-rise>*{animation:vac-rise .6s ease-out both}
.vac-rise>*:nth-child(1){animation-delay:.25s}.vac-rise>*:nth-child(2){animation-delay:.33s}.vac-rise>*:nth-child(3){animation-delay:.41s}
.vac-rise>*:nth-child(4){animation-delay:.49s}.vac-rise>*:nth-child(5){animation-delay:.57s}.vac-rise>*:nth-child(6){animation-delay:.65s}
.vac-rise>.vac-orders{animation:vac-rise .6s ease-out .4s both,vac-orders-glow 2.6s ease-in-out 1.4s infinite}
.vac-rise>*:nth-child(7){animation-delay:.73s}.vac-rise>*:nth-child(8){animation-delay:.81s}
@keyframes vac-fade{from{opacity:0}to{opacity:1}}
@keyframes vac-pop{0%{opacity:0;transform:translateY(24px) scale(.92)}100%{opacity:1;transform:none}}
@keyframes vac-spin{to{transform:rotate(360deg)}}
@keyframes vac-pulse{0%,100%{transform:scale(1);opacity:.9}50%{transform:scale(1.12);opacity:1}}
@keyframes vac-drift{from{transform:translateX(-160px)}to{transform:translateX(700px)}}
@keyframes vac-fly{from{transform:translate(-40px,0)}50%{transform:translate(300px,-10px)}to{transform:translate(620px,4px)}}
@keyframes vac-flap{0%,100%{transform:scaleY(1)}50%{transform:scaleY(-.5)}}
@keyframes vac-sway{0%,100%{transform:rotate(-1.2deg)}50%{transform:rotate(1.4deg)}}
@keyframes vac-frond{0%,100%{transform:rotate(-3.5deg)}50%{transform:rotate(3.5deg)}}
@keyframes vac-wave{from{transform:translateX(0)}to{transform:translateX(-130px)}}
@keyframes vac-glint{0%,100%{opacity:.15;transform:scaleX(.6)}50%{opacity:.95;transform:scaleX(1.15)}}
@keyframes vac-twinkle{0%,100%{opacity:0;transform:scale(.5)}50%{opacity:.95;transform:scale(1)}}
@keyframes vac-tide{0%,100%{transform:translate(0,3px)}50%{transform:translate(-5px,-4px)}}
@keyframes vac-surf{0%,100%{opacity:.35;transform:translateY(4px)}50%{opacity:.85;transform:translateY(-3px)}}
@keyframes vac-kb{from{transform:scale(1) translateX(0)}to{transform:scale(1.12) translateX(-2%)}}
@keyframes vac-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
@keyframes vac-charge{from{width:0}}
@keyframes vac-batglow{0%,100%{box-shadow:0 0 0 rgba(34,197,94,0)}50%{box-shadow:0 0 14px rgba(255,255,255,.9) inset}}
@keyframes vac-stripes{to{background-position:28px 0}}
@keyframes vac-shine{from{background-position:200% 0}to{background-position:-200% 0}}
@keyframes vac-bolt{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.55;transform:scale(1.25)}}
@keyframes vac-blink-low{0%,100%{opacity:1}50%{opacity:.55}}
@keyframes vac-dot{0%,100%{opacity:.2}50%{opacity:1}}
@keyframes vac-orders-glow{0%,100%{box-shadow:0 6px 18px rgba(16,185,129,.18)}50%{box-shadow:0 6px 26px rgba(16,185,129,.5)}}
@keyframes vac-ping{0%{transform:scale(1);opacity:.7}80%,100%{transform:scale(1.9);opacity:0}}
@keyframes vac-draw{to{stroke-dashoffset:0}}
@keyframes vac-rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion: reduce){
  .vac-overlay,.vac-card,.vac-rays,.vac-glow,.vac-cloud-a,.vac-cloud-b,.vac-bird,.vac-bird path,.vac-palm,.vac-frond,.vac-wave-a,.vac-wave-b,.vac-wave-c,.vac-glint,.vac-twinkle,.vac-foam,.vac-surf,.vac-kenburns,.vac-logo,.vac-fill,.vac-stripes,.vac-fill-shine,.vac-bolt,.vac-low,.vac-dots span,.vac-orders,.vac-ping,.vac-rise>*,.vac-rise>.vac-orders{animation:none!important}
  .vac-check{animation:none!important;stroke-dashoffset:0}
}
`;

// Crêtes de vagues : motif répété tous les 130 px, assez large pour boucler sans saut.
function crest(y: number, amp: number) {
  let d = `M0 ${y}`;
  for (let x = 0; x < 780; x += 130) d += ` q32.5 ${-amp} 65 0 t65 0`;
  return d;
}

const GLINTS = [
  { y: 110, w: 14 }, { y: 115, w: 22 }, { y: 120, w: 30 }, { y: 126, w: 40 }, { y: 133, w: 50 },
  { y: 141, w: 62 }, { y: 150, w: 74 }, { y: 160, w: 86 }, { y: 171, w: 98 },
];
const SPARKLES = [
  [60, 116], [140, 122], [210, 112], [300, 118], [470, 114], [500, 128], [260, 134], [180, 150],
  [330, 146], [440, 142], [90, 138], [380, 160], [250, 168], [480, 170], [330, 182],
];
// Palmes : angle (° autour du cœur du palmier), miroir (-1 = vers la gauche), longueur, teinte, décalage d'animation
const FRONDS: { a: number; m: 1 | -1; l: number; c: number; d: number }[] = [
  { a: -78, m: 1, l: 0.9, c: 1, d: -0.4 },
  { a: -108, m: -1, l: 0.95, c: 0, d: -1.6 },
  { a: -18, m: 1, l: 1.15, c: 0, d: -2.4 },
  { a: -158, m: -1, l: 1.1, c: 1, d: -3.1 },
  { a: 14, m: 1, l: 1.05, c: 1, d: -0.9 },
  { a: 168, m: -1, l: 1.0, c: 0, d: -2 },
  { a: -48, m: 1, l: 1.05, c: 0, d: -3.6 },
  { a: -133, m: -1, l: 1.0, c: 1, d: -1 },
];

function Scene() {
  const rays = Array.from({ length: 14 }, (_, i) => i * (360 / 14));
  return (
    <svg viewBox="0 24 520 164" preserveAspectRatio="xMidYMid slice" className="block h-[136px] w-full sm:h-[150px]" aria-hidden="true">
      <defs>
        <linearGradient id="vacSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2A8FE8" />
          <stop offset="0.55" stopColor="#8FD0F8" />
          <stop offset="1" stopColor="#FFE9B8" />
        </linearGradient>
        <linearGradient id="vacSea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8EE3EE" />
          <stop offset="0.35" stopColor="#25B7DC" />
          <stop offset="1" stopColor="#0A78B8" />
        </linearGradient>
        <linearGradient id="vacSand" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FBE9BC" />
          <stop offset="1" stopColor="#E3BE76" />
        </linearGradient>
        <linearGradient id="vacLeafA" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#0F7A36" />
          <stop offset="1" stopColor="#35BE5B" />
        </linearGradient>
        <linearGradient id="vacLeafB" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#0B6A2E" />
          <stop offset="1" stopColor="#23A24A" />
        </linearGradient>
        <linearGradient id="vacTrunk" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#6E4521" />
          <stop offset="0.5" stopColor="#A06B36" />
          <stop offset="1" stopColor="#7A4C25" />
        </linearGradient>
        <radialGradient id="vacSun">
          <stop offset="0" stopColor="#FFFDE6" />
          <stop offset="0.6" stopColor="#FFE680" />
          <stop offset="1" stopColor="#FFC83A" />
        </radialGradient>
        <radialGradient id="vacHalo">
          <stop offset="0" stopColor="#FFF3B0" stopOpacity="0.95" />
          <stop offset="0.35" stopColor="#FFE27A" stopOpacity="0.45" />
          <stop offset="1" stopColor="#FFE27A" stopOpacity="0" />
        </radialGradient>
        <filter id="vacSoft" x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="1.4" />
        </filter>
        <clipPath id="vacSeaClip">
          <rect x="0" y="104" width="520" height="96" />
        </clipPath>
      </defs>

      {/* ciel */}
      <rect width="520" height="110" fill="url(#vacSky)" />

      {/* soleil + halo + rayons */}
      <g>
        <circle className="vac-glow" cx="392" cy="96" r="92" fill="url(#vacHalo)" />
        <g className="vac-rays" opacity="0.5">
          {rays.map((a) => (
            <line key={a} x1="392" y1="62" x2="392" y2="40" stroke="#FFF1A8" strokeWidth="3.5" strokeLinecap="round" transform={`rotate(${a} 392 96)`} />
          ))}
        </g>
        <circle cx="392" cy="96" r="25" fill="url(#vacSun)" />
      </g>

      {/* nuages */}
      <g className="vac-cloud-a" opacity="0.95" filter="url(#vacSoft)">
        <ellipse cx="40" cy="44" rx="30" ry="9" fill="#fff" />
        <ellipse cx="60" cy="36" rx="20" ry="11" fill="#fff" />
        <ellipse cx="24" cy="38" rx="14" ry="8" fill="#fff" />
      </g>
      <g className="vac-cloud-b" opacity="0.75" filter="url(#vacSoft)">
        <ellipse cx="0" cy="72" rx="34" ry="8" fill="#fff" />
        <ellipse cx="22" cy="65" rx="22" ry="10" fill="#fff" />
      </g>

      {/* mouettes */}
      <g className="vac-bird" opacity="0.85">
        <path d="M0 40 q5 -6 10 0 q5 -6 10 0" fill="none" stroke="#2F4A66" strokeWidth="1.6" strokeLinecap="round" />
      </g>
      <g className="vac-bird vac-bird-2" opacity="0.7">
        <path d="M0 58 q4 -5 8 0 q4 -5 8 0" fill="none" stroke="#2F4A66" strokeWidth="1.4" strokeLinecap="round" />
      </g>

      {/* mer */}
      <rect y="104" width="520" height="96" fill="url(#vacSea)" />
      <g clipPath="url(#vacSeaClip)">
        {/* reflet du soleil */}
        {GLINTS.map((g, i) => (
          <rect key={i} className="vac-glint" x={392 - g.w / 2} y={g.y} width={g.w} height="2.2" rx="1.1" fill="#FFF7C9" style={{ animationDelay: `${-i * 0.27}s` }} />
        ))}
        {/* crêtes qui avancent */}
        <g className="vac-wave-a" opacity="0.55">
          <path d={crest(118, 3)} fill="none" stroke="#fff" strokeWidth="1.3" />
        </g>
        <g className="vac-wave-b" opacity="0.5">
          <path d={crest(138, 4)} fill="none" stroke="#fff" strokeWidth="1.5" transform="translate(-40 0)" />
        </g>
        <g className="vac-wave-c" opacity="0.6">
          <path d={crest(162, 5)} fill="none" stroke="#fff" strokeWidth="1.8" transform="translate(-85 0)" />
        </g>
        {/* paillettes */}
        {SPARKLES.map(([x, y], i) => (
          <circle key={i} className="vac-twinkle" cx={x} cy={y} r={i % 3 === 0 ? 1.8 : 1.3} fill="#fff" style={{ animationDelay: `${-i * 0.37}s` }} />
        ))}
      </g>
      <line x1="0" y1="104.5" x2="520" y2="104.5" stroke="#fff" strokeOpacity="0.5" strokeWidth="1" />

      {/* plage */}
      <path d="M0 200 V152 Q80 138 160 158 Q225 176 262 200 Z" fill="url(#vacSand)" />
      <path d="M0 200 V176 Q64 166 128 180 Q178 190 206 200 Z" fill="#D9AE62" opacity="0.5" />
      {/* écume qui avance et recule le long du sable */}
      <g className="vac-foam">
        <path d="M0 150 Q80 135 162 156 Q230 174 268 200 L290 200 Q246 168 176 148 Q84 124 0 140 Z" fill="#fff" opacity="0.8" />
      </g>
      <g className="vac-surf">
        <path d="M0 144 Q84 128 170 150 Q240 168 282 200" fill="none" stroke="#BDF0F5" strokeWidth="5" strokeLinecap="round" opacity="0.7" />
      </g>
      <ellipse cx="92" cy="190" rx="52" ry="5" fill="#8F6A2C" opacity="0.25" />

      {/* palmier */}
      <g className="vac-palm">
        <path d="M66 196 C 70 160, 92 128, 112 84 L 120 86 C 104 130, 84 162, 84 196 Z" fill="url(#vacTrunk)" />
        {[176, 164, 152, 140, 128, 116, 104, 94].map((y, i) => (
          <path key={y} d={`M${72 + i * 5.3} ${y} q9 3 17 0`} fill="none" stroke="#5B3818" strokeOpacity="0.55" strokeWidth="1.2" />
        ))}
        {FRONDS.map((f, i) => (
          <g key={i} className="vac-frond" style={{ animationDelay: `${f.d}s` }}>
            <g transform={`translate(114 82) rotate(${f.a}) scale(${f.m * f.l} ${f.l})`}>
              <path d="M0 0 C 18 -22, 52 -26, 84 8 C 58 -6, 26 -6, 0 0 Z" fill={f.c ? 'url(#vacLeafA)' : 'url(#vacLeafB)'} />
              <path d="M0 0 C 26 -12, 56 -10, 84 8" fill="none" stroke="#0B5A27" strokeOpacity="0.55" strokeWidth="1" />
            </g>
          </g>
        ))}
        <circle cx="111" cy="90" r="4.6" fill="#6B4423" />
        <circle cx="120" cy="91" r="4.6" fill="#7A4F28" />
        <circle cx="115" cy="97" r="4.6" fill="#5E3B1D" />
      </g>

      {/* vague d'avant-plan */}
      <g className="vac-wave-c" opacity="0.5">
        <path d={`${crest(193, 4)} V200 H0 Z`} fill="#BDF0F5" transform="translate(-30 0)" />
      </g>
    </svg>
  );
}

function Hero({ mediaUrl }: { mediaUrl: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [mediaUrl]);
  const url = (mediaUrl ?? '').trim();
  const isVideo = /\.(mp4|webm|ogv)(\?.*)?$/i.test(url);
  const isImage = /\.(jpe?g|png|webp|gif|avif|svg)(\?.*)?$/i.test(url);
  if (!url || failed || (!isVideo && !isImage)) return <Scene />;
  const cls = 'block h-[136px] w-full object-cover sm:h-[150px]';
  if (isVideo) {
    return <video className={cls} src={url} autoPlay muted loop playsInline preload="auto" aria-hidden="true" onError={() => setFailed(true)} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className={`${cls} vac-kenburns`} src={url} alt="" aria-hidden="true" onError={() => setFailed(true)} />
  );
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function dayWord(n: number) {
  return n <= 1 ? `${n} jour` : `${n} jours`;
}

// Pourcentage qui grimpe de 0 à la valeur finale, en même temps que la barre se remplit.
function Counter({ to }: { to: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setV(to);
      return;
    }
    setV(0);
    let raf = 0;
    let t0 = 0;
    const dur = 2400;
    const timer = setTimeout(() => {
      const step = (t: number) => {
        if (!t0) t0 = t;
        const k = Math.min(1, (t - t0) / dur);
        setV(Math.round(to * (1 - Math.pow(1 - k, 3))));
        if (k < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, 700);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [to]);
  return <>{v}</>;
}

export function VacationCard({
  data,
  onClose,
  preview = false,
  inline = false,
  maxHeightClass = 'max-h-[94vh]',
}: {
  data: VacationPayload;
  onClose?: () => void;
  preview?: boolean;
  inline?: boolean;
  maxHeightClass?: string;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const during = data.phase === 'during';

  useEffect(() => {
    if (!inline) closeRef.current?.focus();
  }, [inline]);

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
  const c1 = low ? '#EF4444' : data.percent < 50 ? '#F59E0B' : '#22C55E';
  const c2 = low ? '#FCA5A5' : data.percent < 50 ? '#FCD34D' : '#86EFAC';
  const hasOrders = !!(data.orderTitle?.trim() || data.orderInfo?.trim());

  return (
    <div
      role={inline ? 'group' : 'dialog'}
      aria-modal={inline ? undefined : true}
      aria-labelledby="vac-title"
      className={`vac-card relative w-full max-w-[560px] ${inline ? 'mx-auto' : `overflow-y-auto ${maxHeightClass}`} rounded-3xl bg-white shadow-2xl`}
      onClick={(e) => e.stopPropagation()}
    >
      <style>{CSS}</style>
      <div className="relative overflow-hidden rounded-t-3xl">
        <Hero mediaUrl={data.mediaUrl} />
        {onClose && !inline && (
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="absolute right-3 top-3 h-9 w-9 rounded-full bg-white/90 text-lg leading-none text-gray-700 shadow transition hover:bg-white"
          >
            ✕
          </button>
        )}
      </div>

      <div className="relative -mt-10 flex justify-center">
        <div className="vac-logo flex h-[100px] w-[100px] items-center justify-center rounded-[24px] bg-white shadow-xl ring-4 ring-white">
          <AnimatedLogo size={94} />
        </div>
      </div>

      <div className="vac-rise px-5 pb-5 pt-2.5 text-center sm:px-8">
        <span className="inline-block rounded-full bg-brand-light px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-brand-dark">
          {during ? '🌴 ReparMonPhone est en vacances' : '🌴 Petite pause en approche'}
        </span>

        <h2 id="vac-title" className="mt-2 text-[25px] font-extrabold leading-tight text-gray-900 sm:text-[27px]">
          {data.title}
          {during && <span className="ml-1.5">✈️</span>}
        </h2>

        <p className="mt-1.5 text-[14px] leading-relaxed text-gray-600">{data.message}</p>

        {hasOrders && (
          <div className="vac-orders relative mt-3.5 overflow-hidden rounded-2xl border-2 border-emerald-400 bg-gradient-to-br from-emerald-50 to-green-100 px-4 py-3 text-left">
            <div className="flex items-start gap-3">
              <span className="relative mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md">
                <span className="vac-ping absolute inset-0 rounded-full bg-emerald-400" />
                <svg viewBox="0 0 24 24" className="relative h-6 w-6" aria-hidden="true">
                  <path className="vac-check" d="M5 13l4 4L19 7" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <div>
                {data.orderTitle?.trim() && <p className="text-[16px] font-extrabold leading-snug text-emerald-900">{data.orderTitle}</p>}
                {data.orderInfo?.trim() && <p className="mt-1 text-[13px] leading-relaxed text-emerald-900/85">{data.orderInfo}</p>}
              </div>
            </div>
          </div>
        )}

        <div className="mt-3 grid gap-3 text-left sm:grid-cols-2">
          <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Départ</p>
                <p className="text-[13px] font-bold leading-snug text-gray-800">{cap(formatDayLong(data.start))}</p>
              </div>
              <span className="text-lg text-brand" aria-hidden="true">→</span>
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
              <div className="relative h-8 flex-1 overflow-hidden rounded-lg border-2 border-gray-300 bg-white">
                <div
                  key={data.percent}
                  className="vac-fill relative h-full rounded-[5px]"
                  style={{ ['--p' as string]: `${data.percent}%`, background: `linear-gradient(90deg, ${c1}, ${c2})` }}
                >
                  <span className="vac-stripes absolute inset-0" />
                  <span className="vac-fill-shine" />
                </div>
                {[25, 50, 75].map((t) => (
                  <span key={t} className="absolute top-0 h-full w-px bg-gray-300/70" style={{ left: `${t}%` }} aria-hidden="true" />
                ))}
                {during && (
                  <span className="vac-bolt absolute inset-0 flex items-center justify-center text-sm" aria-hidden="true">⚡</span>
                )}
              </div>
              <span className="h-3 w-1.5 rounded-r-sm bg-gray-300" aria-hidden="true" />
            </div>
            <p className={`mt-2 text-xs font-bold ${low ? 'vac-low text-red-500' : 'text-gray-700'}`}>
              <Counter key={data.percent} to={data.percent} /> %{' '}
              {during ? (
                <>
                  · en charge
                  <span className="vac-dots" aria-hidden="true">
                    <span>.</span>
                    <span>.</span>
                    <span>.</span>
                  </span>
                </>
              ) : (
                '· recharge imminente'
              )}
            </p>
          </div>
        </div>

        {data.showContact && (
          <p className="mt-3 text-xs text-gray-500">
            Une question ? Écrivez-nous à{' '}
            <a
              href="mailto:contact@reparmonphone.fr"
              className="font-semibold text-brand hover:underline"
              onClick={preview || inline ? (e) => e.preventDefault() : undefined}
            >
              contact@reparmonphone.fr
            </a>{' '}
            — nous répondons dès que possible.
          </p>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-3.5 w-full rounded-xl bg-brand py-3 text-[15px] font-bold text-white shadow-lg shadow-brand/30 transition hover:bg-brand-dark active:scale-[.99]"
        >
          Continuer vers le site
        </button>
      </div>
    </div>
  );
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
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="vac-overlay fixed inset-0 z-[70] flex flex-col items-center justify-center gap-3 bg-slate-900/70 p-3 backdrop-blur-sm sm:p-6"
      onClick={onClose}
    >
      {preview && (
        <div className="max-w-[92vw] shrink-0 rounded-full bg-amber-400 px-4 py-2 text-center text-xs font-semibold text-amber-950 shadow-lg sm:text-sm">
          👁️ Aperçu privé — les visiteurs ne voient rien tant que le mode vacances n&apos;est pas actif
        </div>
      )}
      <VacationCard data={data} onClose={onClose} preview={preview} maxHeightClass={preview ? 'max-h-[calc(100vh-96px)]' : 'max-h-[94vh]'} />
    </div>
  );
}
