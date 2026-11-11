'use client';

// Thèmes saisonniers « fêtes » : BLACK FRIDAY, NOËL, NOUVEL AN & SOLDES D'HIVER, SAINT-VALENTIN.
// Même contrat que HalloweenTheme.tsx : monté par SeasonalTheme.tsx uniquement quand le thème est actif
// (ou en aperçu depuis /admin/themes). Aucun élément ne capte la souris ni ne décale la mise en page :
// tout est en position fixe/absolue avec pointer-events:none, donc le site reste utilisable et le
// score "Core Web Vitals" ne bouge pas.
//
// Règles de sobriété (accessibilité / performance), identiques à Halloween :
//  - "Réduire les animations" activé chez le visiteur => décor FIXE seulement (aucun mouvement).
//  - Mode économie de données => pas d'animations canvas.
//  - Téléphone : moins de particules, pas d'effets "souris".
//  - Onglet masqué : rien ne tourne (requestAnimationFrame se met en pause tout seul).
//  - Pages de paiement (quiet) : seulement l'ambiance, jamais d'éléments qui bougent ni de bandeau.
//
// Style Premium = rendu haute définition en canvas 2D (jusqu'à 2x la densité de pixels pour les écrans
// 4K/Retina), particules sur trois plans de profondeur, lumières floues, relief à la souris.

import { useEffect, useMemo, useRef, useState, type CSSProperties, type MutableRefObject, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { safeHref, type ThemeId, type ThemeOptions } from '@/lib/seasonalThemes';

export type FestiveId = Exclude<ThemeId, 'halloween'>;
type Props = { themeId: FestiveId; options: ThemeOptions; preview: boolean; quiet?: boolean };

const MULT = { doux: 0.55, normal: 1, intense: 1.7 } as const;

// Effets coupés sur les pages de paiement (panier / checkout)
const QUIET_OFF = new Set([
  'banner', 'tag', 'sleigh', 'cursorTrail', 'fireworks', 'confetti', 'hearts', 'petals', 'glitter', 'snow',
  'bokeh', 'spotlights', 'shine', 'aurora',
]);

/* ------------------------------------------------------------------ */
/*  Identité visuelle de chaque thème                                  */
/* ------------------------------------------------------------------ */

type Look = {
  label: string;
  emoji: string;
  session: string;
  /** dégradé du liseré du haut */
  strip: string;
  stripGlow: string;
  /** voile sur les bords + lueur du bas */
  vig: string;
  vigPrem: string;
  select: string;
  banner: {
    bg1: string; bg2: string; border: string; glow: string; text: string; sub: string;
    ctaFrom: string; ctaTo: string; ctaText: string; cdBg: string; cdBd: string; cdText: string; conic: string;
  };
  favicon: string;
  bokeh: string[];
};

const svgUrl = (svg: string) => 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);

const LOOKS: Record<FestiveId, Look> = {
  blackfriday: {
    label: 'Offre Black Friday',
    emoji: '🛍️',
    session: 'fs_bf_banner_closed',
    strip: 'linear-gradient(90deg,#b8860b,#ffe08a,#f5c451,#fff3c4,#b8860b)',
    stripGlow: 'rgba(245,196,81,.7)',
    vig: 'radial-gradient(ellipse at 50% 42%,rgba(0,0,0,0) 56%,rgba(20,14,0,.14) 80%,rgba(12,8,0,.32) 100%),radial-gradient(ellipse 70% 30% at 50% 108%,rgba(245,196,81,.26),rgba(245,196,81,0) 70%)',
    vigPrem: 'radial-gradient(ellipse at 50% 40%,rgba(0,0,0,0) 50%,rgba(20,14,0,.2) 76%,rgba(8,5,0,.46) 100%),radial-gradient(ellipse 80% 26% at 50% 114%,rgba(245,196,81,.36),rgba(245,196,81,0) 70%)',
    select: '#f5c451',
    banner: {
      bg1: 'rgba(14,11,6,.96)', bg2: 'rgba(40,30,8,.96)', border: 'rgba(245,196,81,.7)', glow: 'rgba(245,196,81,.3)',
      text: '#fff', sub: '#ffe9a8', ctaFrom: '#ffe08a', ctaTo: '#f0b100', ctaText: '#2a1c00',
      cdBg: 'rgba(245,196,81,.16)', cdBd: 'rgba(245,196,81,.55)', cdText: '#ffe9a8', conic: '#f5c451,#fff3c4,#b8860b,#ffe08a,#f5c451',
    },
    favicon: svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="M8 30 L30 8 H54 V32 L32 56Z" fill="#f5c451" stroke="#8a6200" stroke-width="3" stroke-linejoin="round"/><circle cx="44" cy="19" r="4.5" fill="#1a1406"/><path d="M20 38 L33 25" stroke="#8a6200" stroke-width="4" stroke-linecap="round"/></svg>'),
    bokeh: ['rgba(255,214,102,.5)', 'rgba(245,196,81,.42)', 'rgba(255,240,190,.5)'],
  },
  noel: {
    label: 'Offre de Noël',
    emoji: '🎄',
    session: 'fs_noel_banner_closed',
    strip: 'linear-gradient(90deg,#7dd3fc,#ffffff,#fca5a5,#86efac,#7dd3fc)',
    stripGlow: 'rgba(125,211,252,.7)',
    vig: 'radial-gradient(ellipse at 50% 42%,rgba(0,0,0,0) 56%,rgba(120,180,240,.14) 80%,rgba(70,130,210,.28) 100%),radial-gradient(ellipse 70% 30% at 50% 108%,rgba(255,255,255,.5),rgba(255,255,255,0) 70%)',
    vigPrem: 'radial-gradient(ellipse at 50% 40%,rgba(0,0,0,0) 50%,rgba(110,170,240,.2) 76%,rgba(50,100,190,.38) 100%),radial-gradient(ellipse 80% 26% at 50% 114%,rgba(255,255,255,.7),rgba(255,255,255,0) 70%)',
    select: '#e63946',
    banner: {
      bg1: 'rgba(8,24,44,.96)', bg2: 'rgba(14,56,50,.96)', border: 'rgba(255,255,255,.55)', glow: 'rgba(125,211,252,.32)',
      text: '#fff', sub: '#d8f0ff', ctaFrom: '#ff6b6b', ctaTo: '#d62839', ctaText: '#fff',
      cdBg: 'rgba(255,255,255,.12)', cdBd: 'rgba(255,255,255,.45)', cdText: '#fff', conic: '#ff4d5a,#ffffff,#2dd4bf,#ffd36b,#ff4d5a',
    },
    favicon: svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="M32 4 L45 22 H38 L50 38 H41 L54 54 H10 L23 38 H14 L26 22 H19Z" fill="#1f8a4c" stroke="#0f5a30" stroke-width="2" stroke-linejoin="round"/><rect x="28" y="54" width="8" height="7" fill="#7b4a1e"/><circle cx="32" cy="10" r="4" fill="#ffd54a"/><circle cx="26" cy="32" r="2.6" fill="#ff4d5a"/><circle cx="38" cy="44" r="2.6" fill="#7dd3fc"/><circle cx="24" cy="48" r="2.4" fill="#ffd54a"/></svg>'),
    bokeh: ['rgba(255,208,110,.5)', 'rgba(255,90,90,.36)', 'rgba(255,240,200,.5)'],
  },
  nouvelan: {
    label: 'Offre Nouvel An',
    emoji: '🎆',
    session: 'fs_ny_banner_closed',
    strip: 'linear-gradient(90deg,#ffd36b,#a78bfa,#f472b6,#ffd36b,#a78bfa)',
    stripGlow: 'rgba(167,139,250,.7)',
    vig: 'radial-gradient(ellipse at 50% 42%,rgba(0,0,0,0) 56%,rgba(80,40,160,.14) 80%,rgba(40,16,100,.3) 100%),radial-gradient(ellipse 70% 30% at 50% 108%,rgba(255,211,107,.26),rgba(255,211,107,0) 70%)',
    vigPrem: 'radial-gradient(ellipse at 50% 40%,rgba(0,0,0,0) 50%,rgba(80,40,160,.2) 76%,rgba(30,10,90,.46) 100%),radial-gradient(ellipse 80% 26% at 50% 114%,rgba(255,211,107,.34),rgba(255,211,107,0) 70%)',
    select: '#a78bfa',
    banner: {
      bg1: 'rgba(16,8,44,.96)', bg2: 'rgba(44,16,78,.96)', border: 'rgba(255,211,107,.65)', glow: 'rgba(167,139,250,.38)',
      text: '#fff', sub: '#e7dcff', ctaFrom: '#ffe08a', ctaTo: '#ff9f1c', ctaText: '#2a1500',
      cdBg: 'rgba(255,211,107,.16)', cdBd: 'rgba(255,211,107,.55)', cdText: '#ffe9a8', conic: '#ffd36b,#a78bfa,#f472b6,#ffe08a,#ffd36b',
    },
    favicon: svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#2a1260"/><path d="M32 6 L37 25 L56 32 L37 39 L32 58 L27 39 L8 32 L27 25Z" fill="#ffd36b"/><circle cx="50" cy="14" r="3" fill="#f472b6"/><circle cx="13" cy="48" r="2.6" fill="#7dd3fc"/></svg>'),
    bokeh: ['rgba(255,211,107,.46)', 'rgba(167,139,250,.4)', 'rgba(244,114,182,.34)'],
  },
  valentin: {
    label: 'Offre Saint-Valentin',
    emoji: '❤️',
    session: 'fs_val_banner_closed',
    strip: 'linear-gradient(90deg,#ff5c8a,#ffc2d6,#e11d62,#ff5c8a,#ffc2d6)',
    stripGlow: 'rgba(255,92,138,.7)',
    vig: 'radial-gradient(ellipse at 50% 42%,rgba(0,0,0,0) 56%,rgba(255,92,150,.12) 80%,rgba(225,29,98,.26) 100%),radial-gradient(ellipse 70% 30% at 50% 108%,rgba(255,92,138,.26),rgba(255,92,138,0) 70%)',
    vigPrem: 'radial-gradient(ellipse at 50% 40%,rgba(0,0,0,0) 50%,rgba(255,92,150,.18) 76%,rgba(190,20,80,.4) 100%),radial-gradient(ellipse 80% 26% at 50% 114%,rgba(255,92,138,.36),rgba(255,92,138,0) 70%)',
    select: '#ff5c8a',
    banner: {
      bg1: 'rgba(70,8,38,.96)', bg2: 'rgba(130,18,70,.96)', border: 'rgba(255,170,200,.65)', glow: 'rgba(255,92,138,.4)',
      text: '#fff', sub: '#ffd9e6', ctaFrom: '#ff8fb0', ctaTo: '#e11d62', ctaText: '#fff',
      cdBg: 'rgba(255,255,255,.12)', cdBd: 'rgba(255,190,215,.55)', cdText: '#ffe3ee', conic: '#ff5c8a,#ffc2d6,#e11d62,#ffd1e0,#ff5c8a',
    },
    favicon: svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="M32 57 C8 40 4 24 14 14 C21 8 29 11 32 19 C35 11 43 8 50 14 C60 24 56 40 32 57Z" fill="#e11d48" stroke="#9f1239" stroke-width="2.5" stroke-linejoin="round"/><ellipse cx="21" cy="21" rx="5" ry="3.2" fill="#fff" opacity=".45" transform="rotate(-35 21 21)"/></svg>'),
    bokeh: ['rgba(255,92,138,.4)', 'rgba(255,160,190,.46)', 'rgba(225,29,72,.3)'],
  },
};

/* ------------------------------------------------------------------ */
/*  Détection de l'environnement du visiteur                           */
/* ------------------------------------------------------------------ */

function useEnv(preview: boolean) {
  const [env, setEnv] = useState({ calm: false, lite: false, mobile: false, fine: true, width: 1280 });
  useEffect(() => {
    const read = () => {
      const reduced = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const conn = (navigator as unknown as { connection?: { saveData?: boolean } }).connection;
      setEnv({
        // En aperçu admin on montre les animations même si le système de Krys réduit les animations.
        calm: reduced && !preview,
        lite: !!conn?.saveData && !preview,
        mobile: window.innerWidth < 768,
        fine: !!window.matchMedia?.('(pointer: fine)').matches && window.innerWidth >= 768,
        width: window.innerWidth,
      });
    };
    read();
    window.addEventListener('resize', read);
    return () => window.removeEventListener('resize', read);
  }, [preview]);
  return env;
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const CSS = `
html[data-season="blackfriday"] ::selection{background:#f5c451;color:#1a1406}
html[data-season="noel"] ::selection{background:#d62839;color:#fff}
html[data-season="nouvelan"] ::selection{background:#a78bfa;color:#fff}
html[data-season="valentin"] ::selection{background:#ff5c8a;color:#fff}
.fs-root{position:fixed;inset:0;pointer-events:none;z-index:45;overflow:hidden}
.fs-root *{pointer-events:none}
.fs-canvas{position:absolute;inset:0;width:100%;height:100%}

/* Lueur d'ambiance */
.fs-vig{position:absolute;inset:0;background:var(--vig)}
.fs-root.prem .fs-vig{background:var(--vigp)}
.fs-strip{position:absolute;left:0;right:0;top:0;height:3px;background:var(--strip);background-size:300% 100%;
  box-shadow:0 0 14px var(--stripglow);animation:fs-strip 9s linear infinite}
.fs-root.prem .fs-strip{height:4px;box-shadow:0 0 22px var(--stripglow),0 0 60px var(--stripglow);animation-duration:7s}
@keyframes fs-strip{to{background-position:-300% 0}}

/* Reflet doré */
.fs-shine{position:absolute;inset:0;overflow:hidden}
.fs-shine::before{content:"";position:absolute;top:-10%;bottom:-10%;left:0;width:34%;
  background:linear-gradient(105deg,transparent 30%,rgba(255,224,138,.20) 50%,transparent 70%);
  transform:translateX(-120%);animation:fs-shine 11s ease-in-out infinite}
@keyframes fs-shine{0%,62%{transform:translateX(-120%)}100%{transform:translateX(420%)}}

/* Projecteurs (premium Black Friday) */
.fs-beam{position:absolute;top:-8vh;width:44vw;height:112vh;transform-origin:50% 0;opacity:.9;
  background:linear-gradient(180deg,rgba(255,224,138,.30),rgba(255,224,138,.06) 55%,rgba(255,224,138,0));
  clip-path:polygon(46% 0,54% 0,100% 100%,0 100%)}
.fs-beam.l{left:-6vw;animation:fs-beamL 15s ease-in-out infinite alternate}
.fs-beam.r{right:-6vw;animation:fs-beamR 19s ease-in-out infinite alternate}
@keyframes fs-beamL{from{transform:rotate(-20deg)}to{transform:rotate(22deg)}}
@keyframes fs-beamR{from{transform:rotate(18deg)}to{transform:rotate(-24deg)}}

/* Aurore (premium Noël) */
.fs-aurora{position:absolute;left:-10%;right:-10%;top:0;height:46vh;opacity:.36;
  -webkit-mask-image:linear-gradient(to bottom,#000 10%,transparent);mask-image:linear-gradient(to bottom,#000 10%,transparent)}
.fs-aurora i{position:absolute;top:-6vh;height:46vh;width:44%;filter:blur(34px);animation:fs-aur 17s ease-in-out infinite alternate;border-radius:50%}
.fs-aurora i:nth-child(1){left:2%;background:radial-gradient(ellipse at 50% 20%,rgba(52,211,153,.55),transparent 68%)}
.fs-aurora i:nth-child(2){left:30%;background:radial-gradient(ellipse at 50% 20%,rgba(96,165,250,.5),transparent 68%);animation-duration:23s;animation-delay:-6s}
.fs-aurora i:nth-child(3){left:56%;background:radial-gradient(ellipse at 50% 20%,rgba(167,139,250,.5),transparent 68%);animation-duration:19s;animation-delay:-11s}
@keyframes fs-aur{from{transform:translateX(-8%) scaleY(.9);opacity:.55}to{transform:translateX(10%) scaleY(1.12);opacity:1}}

/* Étiquette Black Friday */
.fs-tag{position:absolute;top:0;right:2.6%;width:76px;display:flex;flex-direction:column;align-items:center;
  transform:translateY(-100%);animation:fs-tag 34s ease-in-out infinite}
.fs-tag .th{width:2px;height:54px;background:linear-gradient(rgba(245,196,81,0),rgba(245,196,81,.95) 40%)}
.fs-tag .sw{transform-origin:50% 0;animation:fs-sway 3.2s ease-in-out infinite alternate;display:flex;flex-direction:column;align-items:center}
@keyframes fs-tag{0%,4%{transform:translateY(-100%)}9%{transform:translateY(0)}12%{transform:translateY(-4%)}15%,62%{transform:translateY(0)}72%{transform:translateY(-100%)}100%{transform:translateY(-100%)}}
@keyframes fs-sway{from{transform:rotate(-6deg)}to{transform:rotate(6deg)}}

/* Traîneau */
.fs-sleigh{position:absolute;left:0;top:0;will-change:transform;transform:translate(-400px,0)}

/* Guirlandes du haut de page (insérées dans <body>) */
.fs-top{position:absolute;top:0;left:0;width:100%;height:30px;z-index:46;pointer-events:none;overflow:hidden}
.fs-top svg{display:block}
.fs-bulb{animation:fs-twk 2.4s ease-in-out infinite alternate}
@keyframes fs-twk{from{opacity:.55}to{opacity:1}}
.fs-pen{transform-box:fill-box;transform-origin:50% 0;animation:fs-pen 3.6s ease-in-out infinite alternate}
@keyframes fs-pen{from{transform:rotate(-5deg)}to{transform:rotate(5deg)}}

/* Décor de pied de page (inséré dans le footer) */
footer.fs-footer{position:relative;margin-top:7rem !important}
.fs-scene{position:absolute;left:0;right:0;bottom:100%;height:clamp(120px,11.5vw,220px);pointer-events:none;overflow:hidden;background:var(--scene)}
.fs-scene svg{position:absolute;inset:0;width:100%;height:100%;display:block}
.fs-star{animation:fs-tw 3s ease-in-out infinite alternate}
@keyframes fs-tw{from{opacity:.25}to{opacity:1}}
.fs-win{animation:fs-flick 5s infinite}
@keyframes fs-flick{0%,100%{opacity:1}12%{opacity:.7}20%{opacity:1}55%{opacity:.85}62%{opacity:.6}70%{opacity:1}}
.fs-rise{transform-box:fill-box;transform-origin:50% 100%;animation:fs-rise 14s ease-in-out infinite alternate}
@keyframes fs-rise{from{transform:translateY(6px) rotate(-2deg)}to{transform:translateY(-14px) rotate(2deg)}}
.fs-bub{transform-box:fill-box;animation:fs-bub 9s linear infinite;opacity:0}
@keyframes fs-bub{0%{transform:translateY(0);opacity:0}15%{opacity:.8}100%{transform:translateY(-90px);opacity:0}}
.fs-beamr{animation:fs-tw 6s ease-in-out infinite alternate}

/* Bandeau offre */
.fs-banner{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:49;width:min(94vw,760px);
  display:flex;align-items:center;gap:14px;padding:10px 12px 10px 14px;border-radius:18px;color:var(--bt);
  background:linear-gradient(135deg,var(--b1),var(--b2));backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);
  border:1px solid var(--bd);box-shadow:0 14px 44px rgba(10,0,30,.42),0 0 28px var(--bgl);
  pointer-events:auto;animation:fs-pop .7s cubic-bezier(.2,1.3,.4,1) both}
.fs-banner *{pointer-events:auto}
@keyframes fs-pop{from{opacity:0;transform:translateX(-50%) translateY(30px) scale(.94)}to{opacity:1;transform:translateX(-50%)}}
@keyframes fs-bob{from{transform:translateY(-3px) rotate(-4deg)}to{transform:translateY(3px) rotate(4deg)}}
.fs-banner .pk{font-size:30px;line-height:1;filter:drop-shadow(0 0 10px var(--bgl));animation:fs-bob 2.4s ease-in-out infinite alternate;flex:none}
.fs-banner .tx{flex:1;min-width:0}
.fs-banner .msg{font-weight:700;font-size:14px;line-height:1.25;text-shadow:0 0 14px var(--bgl)}
.fs-banner .cd{display:flex;gap:6px;margin-top:6px;align-items:center;font-size:11px;color:var(--bs)}
.fs-banner .cd b{display:inline-block;min-width:30px;text-align:center;padding:2px 5px;border-radius:7px;background:var(--cdbg);
  border:1px solid var(--cdbd);color:var(--cdt);font:700 14px/1.15 ui-monospace,SFMono-Regular,Menlo,monospace;font-variant-numeric:tabular-nums}
.fs-banner .cd i{font-style:normal;margin-right:4px;opacity:.85}
.fs-banner .code{flex:none;display:flex;align-items:center;gap:6px;border:1px dashed var(--bd);border-radius:10px;padding:5px 9px;
  background:rgba(255,255,255,.07);color:var(--bs);font:700 12px/1 ui-monospace,SFMono-Regular,Menlo,monospace;cursor:pointer;letter-spacing:.04em}
.fs-banner .code:hover{background:rgba(255,255,255,.14)}
.fs-banner .cta{flex:none;border-radius:11px;padding:9px 14px;font-weight:700;font-size:13px;color:var(--ctat);text-decoration:none;
  background:linear-gradient(135deg,var(--c1),var(--c2));box-shadow:0 4px 14px var(--bgl);transition:transform .15s}
.fs-banner .cta:hover{transform:translateY(-1px) scale(1.03)}
.fs-banner .x{flex:none;width:26px;height:26px;border-radius:50%;border:0;background:rgba(255,255,255,.1);color:#fff;font-size:13px;cursor:pointer;line-height:1}
.fs-banner .x:hover{background:rgba(255,255,255,.22)}
@media (max-width:639px){
  .fs-banner{bottom:84px;flex-wrap:wrap;gap:8px 10px;padding:10px 12px;border-radius:16px}
  .fs-banner .pk{font-size:24px}
  .fs-banner .tx{flex:1 1 calc(100% - 72px)}
  .fs-banner .msg{font-size:12.5px}
  .fs-banner .code,.fs-banner .cta{flex:1 1 auto;text-align:center;justify-content:center}
  .fs-banner .x{position:absolute;top:-8px;right:-4px;background:var(--b2);border:1px solid var(--bd)}
  .fs-tag{scale:.8;transform-origin:top}
}

/* ===== Style PREMIUM ===== */
@property --fs-ang{syntax:'<angle>';inherits:false;initial-value:0deg}
@keyframes fs-ang{to{--fs-ang:360deg}}
@keyframes fs-shinebar{0%,62%{transform:translateX(-130%)}100%{transform:translateX(130%)}}
@keyframes fs-tick{from{transform:translateY(-5px);opacity:.3}to{transform:none;opacity:1}}
.fs-banner.prem{border:1.5px solid transparent;border-radius:20px;overflow:hidden;
  background:linear-gradient(135deg,var(--b1),var(--b2)) padding-box,conic-gradient(from var(--fs-ang),var(--conic)) border-box;
  box-shadow:0 18px 60px rgba(10,0,30,.5),0 0 38px var(--bgl),inset 0 1px 0 rgba(255,255,255,.08);
  animation:fs-pop .8s cubic-bezier(.2,1.3,.4,1) both,fs-ang 7s linear infinite}
.fs-banner.prem::after{content:"";position:absolute;inset:0;pointer-events:none;
  background:linear-gradient(115deg,transparent 40%,rgba(255,255,255,.16) 50%,transparent 60%);animation:fs-shinebar 6s ease-in-out infinite}
.fs-banner.prem .cd b{animation:fs-tick .45s ease-out}

/* Visiteur qui demande moins d'animations : décor figé */
.fs-calm *,.fs-calm{animation:none !important}
.fs-calm .fs-tag{display:none}
.fs-calm .fs-bub{opacity:0}
`;

/* ------------------------------------------------------------------ */
/*  Moteur de particules (canvas)                                      */
/* ------------------------------------------------------------------ */

type Kind = 'snow' | 'glitter' | 'confetti' | 'hearts' | 'petals' | 'bokeh';
type Setup = (c: { ctx: CanvasRenderingContext2D; dpr: number; size: () => { w: number; h: number } }) => { frame: (t: number) => void; cleanup?: () => void };

function useCanvasLoop(ref: RefObject<HTMLCanvasElement | null>, active: boolean, dprCap: number, setup: Setup, deps: unknown[]) {
  useEffect(() => {
    const canvas = ref.current;
    if (!active || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    let w = 0;
    let h = 0;
    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    };
    resize();
    window.addEventListener('resize', resize);
    const { frame, cleanup } = setup({ ctx, dpr, size: () => ({ w, h }) });
    let raf = 0;
    const loop = (t: number) => {
      frame(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      cleanup?.();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, active, dprCap, ...deps]);
}

function mkSprite(size: number, draw: (c: CanvasRenderingContext2D, s: number) => void, blur = 0) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const c = cv.getContext('2d')!;
  if (blur && 'filter' in c) c.filter = `blur(${blur}px)`;
  draw(c, size);
  return cv;
}

function heartPath(c: CanvasRenderingContext2D, u: number) {
  c.beginPath();
  c.moveTo(0, u * 1.05);
  c.bezierCurveTo(-u * 1.9, -u * 0.1, -u * 1.0, -u * 1.5, 0, -u * 0.55);
  c.bezierCurveTo(u * 1.0, -u * 1.5, u * 1.9, -u * 0.1, 0, u * 1.05);
  c.closePath();
}

function heartSprite(color: string, blur = 0) {
  return mkSprite(72, (c, s) => {
    c.translate(s / 2, s / 2 + 2);
    heartPath(c, s * 0.3);
    c.fillStyle = color;
    c.fill();
    c.fillStyle = 'rgba(255,255,255,.4)';
    c.beginPath();
    c.ellipse(-s * 0.13, -s * 0.12, s * 0.07, s * 0.045, -0.6, 0, 6.283);
    c.fill();
  }, blur);
}

function petalSprite(color: string, blur = 0) {
  return mkSprite(64, (c, s) => {
    c.translate(s / 2, s / 2);
    const u = s * 0.3;
    c.beginPath();
    c.moveTo(0, -u * 1.15);
    c.bezierCurveTo(u * 1.25, -u * 0.6, u * 0.95, u * 0.95, 0, u * 1.15);
    c.bezierCurveTo(-u * 0.95, u * 0.95, -u * 1.25, -u * 0.6, 0, -u * 1.15);
    c.fillStyle = color;
    c.fill();
    c.strokeStyle = 'rgba(120,0,40,.28)';
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(0, -u * 0.9);
    c.quadraticCurveTo(u * 0.1, 0, 0, u * 0.9);
    c.stroke();
  }, blur);
}

function snowSprite(blur = 0) {
  // Flocon blanc à ombre bleutée : reste visible sur le fond blanc du site comme sur le pied de page sombre.
  return mkSprite(48, (c, s) => {
    c.shadowColor = 'rgba(70,120,200,.6)';
    c.shadowBlur = s * 0.09;
    c.shadowOffsetY = s * 0.012;
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(s / 2, s / 2, s * 0.2, 0, 6.283);
    c.fill();
  }, blur);
}

function crystalSprite(blur = 0) {
  return mkSprite(96, (c, s) => {
    c.translate(s / 2, s / 2);
    c.strokeStyle = 'rgba(110,165,235,.95)';
    c.lineCap = 'round';
    c.lineWidth = 3.2;
    for (let i = 0; i < 6; i++) {
      c.save();
      c.rotate((i * Math.PI) / 3);
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(0, -s * 0.4);
      c.moveTo(0, -s * 0.24);
      c.lineTo(-s * 0.1, -s * 0.34);
      c.moveTo(0, -s * 0.24);
      c.lineTo(s * 0.1, -s * 0.34);
      c.stroke();
      c.restore();
    }
    c.fillStyle = 'rgba(255,255,255,.95)';
    c.beginPath();
    c.arc(0, 0, s * 0.06, 0, 6.283);
    c.fill();
  }, blur);
}

function glitterSprite(color: string, star: boolean, blur = 0) {
  return mkSprite(48, (c, s) => {
    const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,.95)');
    g.addColorStop(0.2, color);
    g.addColorStop(1, 'rgba(245,196,81,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, s, s);
    if (star) {
      c.translate(s / 2, s / 2);
      c.fillStyle = 'rgba(255,255,255,.95)';
      c.beginPath();
      c.moveTo(0, -s * 0.46);
      c.quadraticCurveTo(s * 0.04, -s * 0.04, s * 0.46, 0);
      c.quadraticCurveTo(s * 0.04, s * 0.04, 0, s * 0.46);
      c.quadraticCurveTo(-s * 0.04, s * 0.04, -s * 0.46, 0);
      c.quadraticCurveTo(-s * 0.04, -s * 0.04, 0, -s * 0.46);
      c.fill();
    }
  }, blur);
}

function bokehSprite(color: string, heart: boolean) {
  return mkSprite(128, (c, s) => {
    c.translate(s / 2, s / 2);
    c.fillStyle = color;
    if (heart) {
      heartPath(c, s * 0.3);
      c.fill();
    } else {
      c.beginPath();
      c.arc(0, 0, s * 0.42, 0, 6.283);
      c.fill();
      c.strokeStyle = 'rgba(255,255,255,.4)';
      c.lineWidth = 2;
      c.stroke();
    }
  }, 3);
}

const CONFETTI = ['#ff4d6d', '#ffc800', '#14b8a6', '#6a4cff', '#ff8a00', '#2fb5e8', '#e91e8c'];

type P = { x: number; y: number; z: number; vx: number; vy: number; s: number; r: number; vr: number; ph: number; f: number; i: number };

function particleSetup(kind: Kind, o: { mult: number; mobile: boolean; premium: boolean; mouse: MutableRefObject<{ x: number; y: number }>; bokeh: string[]; bokehHeart: boolean }): Setup {
  return ({ ctx, dpr, size }) => {
    const prem = o.premium;
    // sprites
    let sprites: { sharp: HTMLCanvasElement; soft: HTMLCanvasElement }[] = [];
    if (kind === 'snow') sprites = [{ sharp: snowSprite(), soft: snowSprite(2.5) }, { sharp: crystalSprite(), soft: crystalSprite(2.5) }];
    if (kind === 'glitter') sprites = ['rgba(255,214,102,.95)', 'rgba(245,196,81,.9)', 'rgba(255,236,170,.95)'].map((c, i) => ({ sharp: glitterSprite(c, i !== 1), soft: glitterSprite(c, false, 2.5) }));
    if (kind === 'hearts') sprites = ['#ff2e63', '#ff6b9d', '#ff9ebb', '#e11d62', '#ff4d7e'].map((c) => ({ sharp: heartSprite(c), soft: heartSprite(c, 3) }));
    if (kind === 'petals') sprites = ['#ff4d79', '#ff7fa3', '#e11d62', '#ff9db8'].map((c) => ({ sharp: petalSprite(c), soft: petalSprite(c, 2.5) }));
    if (kind === 'bokeh') sprites = o.bokeh.map((c) => ({ sharp: bokehSprite(c, o.bokehHeart), soft: bokehSprite(c, o.bokehHeart) }));

    const base: Record<Kind, [number, number]> = { snow: [74, 34], glitter: [48, 22], confetti: [64, 30], hearts: [26, 13], petals: [22, 11], bokeh: [9, 5] };
    const [d, m] = base[kind];
    const count = Math.round((o.mobile ? m : d) * o.mult * (prem && kind !== 'bokeh' ? 1.45 : 1));
    const up = kind === 'hearts';

    const make = (anywhere: boolean): P => {
      const { w, h } = size();
      const z = prem ? Math.random() : 0.35 + Math.random() * 0.6; // profondeur : 0 = loin, 1 = tout près
      return {
        x: Math.random() * w,
        y: anywhere ? Math.random() * h : up ? h + 40 + Math.random() * 60 : -40 - Math.random() * 80,
        z,
        vx: (Math.random() - 0.5) * 0.3,
        vy: 1,
        s: 1,
        r: Math.random() * 6.283,
        vr: (Math.random() - 0.5) * 0.04,
        ph: Math.random() * 6.283,
        f: 0.5 + Math.random() * 1.4,
        i: Math.floor(Math.random() * 8),
      };
    };
    const ps: P[] = Array.from({ length: count }, () => make(true));
    let last = 0;
    const mp = { x: 0.5, y: 0.5 };

    const frame = (t: number) => {
      const { w, h } = size();
      const dt = last ? Math.min(40, t - last) / 16.67 : 1;
      last = t;
      mp.x += (o.mouse.current.x - mp.x) * 0.06;
      mp.y += (o.mouse.current.y - mp.y) * 0.06;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, w * dpr, h * dpr);
      const sec = t / 1000;
      for (const p of ps) {
        const near = p.z > 0.72;
        const far = p.z < 0.3;
        let alpha = 1;
        let px = p.x;
        let size_ = 10;
        switch (kind) {
          case 'snow': {
            const sp = 0.45 + p.z * 1.5;
            p.y += sp * dt;
            p.x += (Math.sin(sec * p.f + p.ph) * 0.5 + 0.18) * (0.5 + p.z) * dt;
            size_ = (far ? 6 : near ? 16 : 10) * (0.7 + p.z * 0.9);
            alpha = far ? 0.55 : near ? 0.9 : 0.85;
            p.r += p.vr * dt;
            if (p.y > h + 30) Object.assign(p, make(false));
            break;
          }
          case 'glitter': {
            p.y += (0.22 + p.z * 0.6) * dt;
            p.x += Math.sin(sec * p.f + p.ph) * 0.25 * dt;
            size_ = (far ? 5 : near ? 12 : 8) * (0.8 + p.z * 0.7);
            alpha = (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(sec * p.f * 2.6 + p.ph))) * (far ? 0.6 : 1);
            p.r += p.vr * dt;
            if (p.y > h + 30) Object.assign(p, make(false));
            break;
          }
          case 'confetti': {
            p.y += (0.9 + p.z * 1.5) * dt;
            p.x += Math.sin(sec * p.f + p.ph) * 0.9 * dt + p.vx;
            p.r += p.vr * 2.4 * dt;
            if (p.y > h + 20) Object.assign(p, make(false));
            break;
          }
          case 'hearts': {
            p.y -= (0.4 + p.z * 0.9) * dt;
            p.x += Math.sin(sec * p.f * 0.8 + p.ph) * 0.55 * dt;
            size_ = (far ? 12 : near ? 34 : 22) * (0.8 + p.z * 0.6);
            alpha = (far ? 0.55 : near ? 0.7 : 0.85) * Math.min(1, p.y / (h * 0.3));
            p.r = Math.sin(sec * p.f + p.ph) * 0.32;
            if (p.y < -40) Object.assign(p, make(false));
            break;
          }
          case 'petals': {
            p.y += (0.55 + p.z * 1.0) * dt;
            p.x += Math.sin(sec * p.f * 0.9 + p.ph) * 1.1 * dt + 0.2;
            p.r += (0.012 + p.z * 0.02) * dt;
            size_ = (far ? 9 : near ? 24 : 15) * (0.8 + p.z * 0.6);
            alpha = far ? 0.6 : 0.9;
            if (p.y > h + 30) Object.assign(p, make(false));
            break;
          }
          case 'bokeh': {
            p.y -= (0.08 + p.z * 0.12) * dt;
            p.x += Math.sin(sec * p.f * 0.2 + p.ph) * 0.2 * dt;
            size_ = 55 + p.z * 95;
            alpha = (0.2 + 0.12 * Math.sin(sec * p.f * 0.5 + p.ph)) * (0.6 + p.z * 0.5);
            if (p.y < -150) Object.assign(p, make(false));
            break;
          }
        }
        if (p.x > w + 40) p.x = -40;
        if (p.x < -40) p.x = w + 40;
        if (prem) px += (0.5 - mp.x) * 60 * p.z + (0.5 - mp.y) * 0;
        const py = p.y + (prem ? (0.5 - mp.y) * 26 * p.z : 0);
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
        if (kind === 'confetti') {
          const col = CONFETTI[p.i % CONFETTI.length];
          const cw = (far ? 5 : near ? 11 : 8) * (0.8 + p.z * 0.5) * (prem ? 1.15 : 1);
          const ch = cw * 0.55;
          const flip = Math.cos(p.r * 1.7);
          ctx.setTransform(dpr * Math.cos(p.r), dpr * Math.sin(p.r), -dpr * Math.sin(p.r), dpr * Math.cos(p.r), px * dpr, py * dpr);
          ctx.fillStyle = col;
          ctx.fillRect(-cw / 2, (-ch / 2) * flip, cw, ch * flip);
        } else {
          let spr = sprites[p.i % sprites.length];
          if (kind === 'snow') spr = sprites[near && prem && p.i % 3 === 0 ? 1 : 0];
          const img = (far || near) && prem ? spr.soft : spr.sharp;
          const sz = kind === 'snow' && spr === sprites[1] ? size_ * 1.7 : size_;
          const rot = kind === 'snow' && spr !== sprites[1] ? 0 : p.r;
          ctx.setTransform(dpr * Math.cos(rot), dpr * Math.sin(rot), -dpr * Math.sin(rot), dpr * Math.cos(rot), px * dpr, py * dpr);
          ctx.drawImage(img, -sz, -sz, sz * 2, sz * 2);
        }
      }
      ctx.globalAlpha = 1;
    };
    return { frame };
  };
}

/** Feux d'artifice discrets : un bouquet au plus toutes les ~1,5 s, jamais de flash plein écran. */
function fireworksSetup(o: { mult: number; mobile: boolean; premium: boolean }): Setup {
  return ({ ctx, dpr, size }) => {
    type S = { x: number; y: number; vx: number; vy: number; life: number; max: number; hue: number; trail: [number, number][] };
    const sparks: S[] = [];
    let nextAt = 700;
    let last = 0;
    const burst = (cx: number, cy: number, hue: number, n: number, speed: number) => {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * 6.283 + Math.random() * 0.1;
        const v = speed * (0.8 + Math.random() * 0.4);
        sparks.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 75 + Math.random() * 35, hue: hue + (Math.random() - 0.5) * 16, trail: [] });
      }
    };
    const frame = (t: number) => {
      const { w, h } = size();
      const dt = last ? Math.min(40, t - last) / 16.67 : 1;
      last = t;
      if (t > nextAt && !document.hidden) {
        const hues = [350, 40, 210, 285, 160, 20];
        const hue = hues[Math.floor(Math.random() * hues.length)];
        const cx = w * (0.12 + Math.random() * 0.76);
        const cy = h * (0.14 + Math.random() * 0.3);
        const sc = Math.min(1, w / 1100);
        burst(cx, cy, hue, Math.round((o.mobile ? 38 : 64) * (o.premium ? 1.4 : 1)), (o.premium ? 4.2 : 3.6) * sc);
        if (o.premium) burst(cx, cy, hue + 25, Math.round((o.mobile ? 18 : 30)), 2.2 * sc);
        nextAt = t + (1500 + Math.random() * 2600) / Math.max(0.7, o.mult);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.lineCap = 'round';
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.life += dt;
        s.trail.push([s.x, s.y]);
        if (s.trail.length > 9) s.trail.shift();
        s.vx *= 0.978;
        s.vy = s.vy * 0.978 + 0.045 * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        const k = 1 - s.life / s.max;
        if (k <= 0) {
          sparks.splice(i, 1);
          continue;
        }
        ctx.strokeStyle = `hsla(${s.hue},95%,50%,${(k * 0.85).toFixed(2)})`;
        ctx.lineWidth = 1.4 + k * 1.8;
        ctx.beginPath();
        ctx.moveTo(s.trail[0][0], s.trail[0][1]);
        for (const [tx, ty] of s.trail) ctx.lineTo(tx, ty);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();
        ctx.fillStyle = `hsla(${s.hue},100%,62%,${Math.min(1, k * 1.2).toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 1 + k * 1.6, 0, 6.283);
        ctx.fill();
      }
    };
    return { frame };
  };
}

type TrailShape = 'star' | 'snow' | 'confetti' | 'heart';

function useCursorTrail(canvasRef: RefObject<HTMLCanvasElement | null>, on: boolean, shape: TrailShape) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!on || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let w = 0;
    let h = 0;
    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    type S = { x: number; y: number; vx: number; vy: number; life: number; max: number; r: number; c: string; rot: number };
    const sparks: S[] = [];
    let raf = 0;
    let lastX = 0;
    let lastY = 0;
    const colorFor = () => {
      if (shape === 'star') return `hsl(${38 + Math.random() * 14},100%,55%)`;
      if (shape === 'snow') return `hsl(${205 + Math.random() * 15},85%,68%)`;
      if (shape === 'heart') return `hsl(${340 + Math.random() * 20},90%,${55 + Math.random() * 12}%)`;
      return CONFETTI[Math.floor(Math.random() * CONFETTI.length)];
    };

    const frame = () => {
      ctx.clearRect(0, 0, w, h);
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.life += 16;
        s.x += s.vx;
        s.y += s.vy;
        s.vy += shape === 'heart' ? -0.012 : 0.03;
        s.rot += 0.08;
        const k = 1 - s.life / s.max;
        if (k <= 0) { sparks.splice(i, 1); continue; }
        ctx.globalAlpha = k;
        ctx.fillStyle = s.c;
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.rot);
        if (shape === 'heart') {
          heartPath(ctx, s.r * 0.9 * k + 1);
          ctx.fill();
        } else if (shape === 'confetti') {
          ctx.fillRect(-s.r, -s.r * 0.5, s.r * 2, s.r);
        } else {
          ctx.shadowColor = s.c;
          ctx.shadowBlur = 8;
          ctx.beginPath();
          if (shape === 'star') {
            const R = s.r * 1.8 * k + 0.6;
            ctx.moveTo(0, -R); ctx.lineTo(R * 0.28, -R * 0.28); ctx.lineTo(R, 0); ctx.lineTo(R * 0.28, R * 0.28);
            ctx.lineTo(0, R); ctx.lineTo(-R * 0.28, R * 0.28); ctx.lineTo(-R, 0); ctx.lineTo(-R * 0.28, -R * 0.28);
            ctx.closePath();
          } else {
            ctx.arc(0, 0, s.r * k + 0.5, 0, 6.283);
          }
          ctx.fill();
        }
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      raf = sparks.length ? requestAnimationFrame(frame) : 0;
    };

    const move = (e: MouseEvent) => {
      const d = Math.hypot(e.clientX - lastX, e.clientY - lastY);
      lastX = e.clientX;
      lastY = e.clientY;
      if (d < 3) return;
      for (let i = 0; i < 2; i++) {
        sparks.push({
          x: e.clientX, y: e.clientY,
          vx: (Math.random() - 0.5) * 1.3, vy: (Math.random() - 0.8) * 1.3,
          life: 0, max: 560 + Math.random() * 420, r: 2 + Math.random() * 2.6, c: colorFor(), rot: Math.random() * 6,
        });
      }
      if (sparks.length > 90) sparks.splice(0, sparks.length - 90);
      if (!raf) raf = requestAnimationFrame(frame);
    };
    window.addEventListener('mousemove', move, { passive: true });
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('resize', resize);
      if (raf) cancelAnimationFrame(raf);
      ctx.clearRect(0, 0, w, h);
    };
  }, [canvasRef, on, shape]);
}

function useMouse(on: boolean) {
  const m = useRef({ x: 0.5, y: 0.5 });
  useEffect(() => {
    if (!on) {
      m.current = { x: 0.5, y: 0.5 };
      return;
    }
    const move = (e: MouseEvent) => {
      m.current = { x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight };
    };
    window.addEventListener('mousemove', move, { passive: true });
    return () => window.removeEventListener('mousemove', move);
  }, [on]);
  return m;
}

/* ------------------------------------------------------------------ */
/*  Traîneau du Père Noël                                              */
/* ------------------------------------------------------------------ */

function reindeer(x: number, y: number, lead: boolean) {
  const leg = (dx: number, a: number, b: number) =>
    `<path d="M${x + dx},${y + 5} L${x + dx + a},${y + 16} L${x + dx + b},${y + 20}" stroke="#2a1b12" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  return (
    `<g>` +
    leg(-11, -7, -12) + leg(-7, 3, 7) + leg(9, 8, 13) + leg(13, -2, -7) +
    `<ellipse cx="${x}" cy="${y}" rx="15" ry="7" fill="#5a3a22"/>` +
    `<path d="M${x + 11},${y - 3} Q${x + 18},${y - 11} ${x + 21},${y - 14}" stroke="#5a3a22" stroke-width="6" fill="none" stroke-linecap="round"/>` +
    `<ellipse cx="${x + 24}" cy="${y - 15}" rx="6" ry="4.2" fill="#6b452a" transform="rotate(-18 ${x + 24} ${y - 15})"/>` +
    `<circle cx="${x + 29}" cy="${y - 14}" r="2" fill="${lead ? '#ff2d2d' : '#2a1b12'}"/>` +
    (lead ? `<circle cx="${x + 29}" cy="${y - 14}" r="5" fill="#ff2d2d" opacity=".35"/>` : '') +
    `<path d="M${x + 21},${y - 19} q-3,-8 -9,-9 M${x + 17},${y - 24} q4,-5 9,-4 M${x + 24},${y - 19} q2,-9 8,-11 M${x + 28},${y - 25} q4,-3 8,-1" stroke="#3b2616" stroke-width="1.7" fill="none" stroke-linecap="round"/>` +
    `</g>`
  );
}

const SLEIGH_SVG =
  '<svg viewBox="0 0 300 80" width="100%" style="display:block;overflow:visible" aria-hidden="true">' +
  '<path d="M6,66 Q40,76 92,66 Q106,64 110,52" stroke="#d4a017" stroke-width="3" fill="none" stroke-linecap="round"/>' +
  '<path d="M16,56 L22,36 L92,36 Q106,36 108,26 L102,50 Q98,62 86,62 L28,62Z" fill="#b91c1c"/>' +
  '<path d="M18,50 H98" stroke="#fbbf24" stroke-width="2"/>' +
  '<ellipse cx="30" cy="34" rx="12" ry="9" fill="#7f5539"/>' +
  '<rect x="46" y="22" width="22" height="16" rx="6" fill="#d62828"/>' +
  '<circle cx="58" cy="17" r="6.5" fill="#f4c7a1"/>' +
  '<path d="M51,20 Q52,6 66,10 L60,18Z" fill="#d62828"/><circle cx="66" cy="10" r="3" fill="#fff"/>' +
  '<path d="M52,20 Q58,30 64,20Z" fill="#fff"/>' +
  '<path d="M108,30 Q150,34 176,40 M108,34 Q170,40 226,44" stroke="#8a6a2a" stroke-width="1.2" fill="none"/>' +
  reindeer(172, 40, false) +
  reindeer(230, 44, true) +
  '</svg>';

function useSleigh(host: RefObject<HTMLDivElement | null>, on: boolean, preview: boolean) {
  useEffect(() => {
    const el = host.current;
    if (!on || !el) return;
    let timer: ReturnType<typeof setTimeout>;
    let alive = true;
    let anim: Animation | null = null;
    let node: HTMLDivElement | null = null;
    const fly = () => {
      if (!alive) return;
      if (!document.hidden && !anim) {
        const W = window.innerWidth;
        const H = window.innerHeight;
        const dir = Math.random() < 0.5 ? 1 : -1;
        const width = Math.max(150, Math.min(300, W * 0.2));
        node = document.createElement('div');
        node.className = 'fs-sleigh';
        node.style.width = `${width}px`;
        node.innerHTML = SLEIGH_SVG;
        if (dir < 0) (node.firstElementChild as SVGElement).style.transform = 'scaleX(-1)';
        el.appendChild(node);
        const x0 = dir > 0 ? -width - 20 : W + 20;
        const x1 = dir > 0 ? W + 20 : -width - 20;
        const y0 = H * (0.08 + Math.random() * 0.18);
        const frames: Keyframe[] = [];
        const n = 12;
        for (let i = 0; i <= n; i++) {
          const t = i / n;
          frames.push({ transform: `translate(${(x0 + (x1 - x0) * t).toFixed(0)}px,${(y0 + Math.sin(t * Math.PI * 2.2) * 16 - t * 20).toFixed(0)}px) rotate(${(dir * Math.cos(t * Math.PI * 2.2) * 3).toFixed(1)}deg)`, offset: t });
        }
        anim = node.animate(frames, { duration: 15000 + Math.random() * 5000, easing: 'linear', fill: 'forwards' });
        const n2 = node;
        anim.onfinish = () => {
          n2.remove();
          anim = null;
        };
      }
      timer = setTimeout(fly, 45000 + Math.random() * 35000);
    };
    timer = setTimeout(fly, preview ? 1200 : 7000);
    return () => {
      alive = false;
      clearTimeout(timer);
      anim?.cancel();
      node?.remove();
    };
  }, [host, on, preview]);
}

/* ------------------------------------------------------------------ */
/*  Icône d'onglet                                                     */
/* ------------------------------------------------------------------ */

function useFavicon(on: boolean, href: string) {
  const pathname = usePathname();
  useEffect(() => {
    if (!on) return;
    const saved: { el: HTMLLinkElement; href: string; type: string }[] = [];
    let created: HTMLLinkElement | null = null;
    const links = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]'));
    if (links.length === 0) {
      created = document.createElement('link');
      created.rel = 'icon';
      document.head.appendChild(created);
      links.push(created);
    }
    for (const l of links) {
      saved.push({ el: l, href: l.getAttribute('href') ?? '', type: l.getAttribute('type') ?? '' });
      l.setAttribute('type', 'image/svg+xml');
      l.removeAttribute('sizes');
      l.setAttribute('href', href);
    }
    return () => {
      for (const s of saved) {
        if (created && s.el === created) continue;
        s.el.setAttribute('href', s.href);
        if (s.type) s.el.setAttribute('type', s.type);
        else s.el.removeAttribute('type');
      }
      created?.remove();
    };
  }, [on, pathname, href]);
}

/* ------------------------------------------------------------------ */
/*  Guirlandes du haut de page                                         */
/* ------------------------------------------------------------------ */

const BULBS = ['#ff4d5a', '#ffd54a', '#4ade80', '#60a5fa', '#f472b6'];
const PEN = ['#ff4d6d', '#ffc800', '#14b8a6', '#6a4cff', '#ff8a00', '#2fb5e8'];

function swag(x0: number, x1: number, amp: number) {
  const xm = (x0 + x1) / 2;
  return { d: `M${x0},2 Q${xm},${2 + amp * 2} ${x1},2`, at: (t: number): [number, number] => [(1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * xm + t * t * x1, (1 - t) * (1 - t) * 2 + 2 * (1 - t) * t * (2 + amp * 2) + t * t * 2] };
}

function TopString({ kind, width }: { kind: 'lights' | 'pennants' | 'hangingHearts'; width: number }) {
  const step = kind === 'hangingHearts' ? 130 : 116;
  const n = Math.ceil(width / step) + 1;
  const items: ReactNode[] = [];
  for (let s = 0; s < n; s++) {
    const x0 = s * step;
    const x1 = x0 + step;
    const sw = swag(x0, x1, 5);
    items.push(<path key={`w${s}`} d={sw.d} stroke={kind === 'lights' ? '#1f3d2b' : 'rgba(40,30,60,.6)'} strokeWidth="1.3" fill="none" />);
    const per = kind === 'hangingHearts' ? 3 : kind === 'pennants' ? 5 : 4;
    for (let k = 0; k < per; k++) {
      const t = (k + 0.5) / per;
      const [x, y] = sw.at(t);
      const idx = s * per + k;
      if (kind === 'lights') {
        const c = BULBS[idx % BULBS.length];
        items.push(
          <g key={`b${idx}`} className="fs-bulb" style={{ animationDelay: `${(idx % 7) * 0.33}s` }}>
            <path d={`M${x},${y} v3`} stroke="#1f3d2b" strokeWidth="1.3" />
            <ellipse cx={x} cy={y + 7} rx="2.9" ry="4.2" fill={c} />
            <ellipse cx={x} cy={y + 7} rx="5.6" ry="6.8" fill={c} opacity=".28" />
            <ellipse cx={x - 0.9} cy={y + 5.8} rx=".8" ry="1.3" fill="#fff" opacity=".7" />
          </g>,
        );
      } else if (kind === 'pennants') {
        const c = PEN[idx % PEN.length];
        items.push(
          <path key={`p${idx}`} className="fs-pen" style={{ animationDelay: `${(idx % 5) * 0.4}s` }} d={`M${x - 5},${y} L${x + 5},${y} L${x},${y + 10}Z`} fill={c} />,
        );
      } else {
        const c = idx % 2 ? '#ff6b9d' : '#e11d48';
        const sz = idx % 3 === 0 ? 0.72 : 0.58;
        items.push(
          <g key={`h${idx}`} className="fs-pen" style={{ animationDelay: `${(idx % 5) * 0.4}s` }}>
            <path d={`M${x},${y} v3`} stroke="rgba(120,20,60,.6)" strokeWidth="1" />
            <g transform={`translate(${x} ${y + 9}) scale(${sz})`}>
              <path d="M0,6 C-9,-1 -8,-9 -3.4,-9 C-1.2,-9 0,-7 0,-6 C0,-7 1.2,-9 3.4,-9 C8,-9 9,-1 0,6Z" fill={c} />
              <ellipse cx="-3.4" cy="-4.6" rx="1.8" ry="1.1" fill="#fff" opacity=".45" transform="rotate(-30 -3.4 -4.6)" />
            </g>
          </g>,
        );
      }
    }
  }
  return (
    <svg width={width} height="30" viewBox={`0 0 ${width} 30`} aria-hidden="true">
      {items}
    </svg>
  );
}

function Tag() {
  return (
    <div className="fs-tag">
      <div className="th" />
      <div className="sw">
        <svg viewBox="0 0 76 100" width="76" height="100" aria-hidden="true" style={{ display: 'block', marginTop: -2, filter: 'drop-shadow(0 6px 10px rgba(120,80,0,.35))' }}>
          <defs>
            <linearGradient id="fsTagG" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#fff3c4" />
              <stop offset=".45" stopColor="#f5c451" />
              <stop offset="1" stopColor="#b8860b" />
            </linearGradient>
          </defs>
          <path d="M38,2 L72,22 V92 Q72,98 66,98 H10 Q4,98 4,92 V22Z" fill="url(#fsTagG)" stroke="#8a6200" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="38" cy="18" r="5" fill="#1a1406" />
          <text x="38" y="52" textAnchor="middle" fontFamily="Arial Black,Arial,sans-serif" fontWeight="900" fontSize="13" fill="#1a1406">BLACK</text>
          <text x="38" y="68" textAnchor="middle" fontFamily="Arial Black,Arial,sans-serif" fontWeight="900" fontSize="13" fill="#1a1406">FRIDAY</text>
          <path d="M16,78 H60" stroke="#1a1406" strokeWidth="1.6" strokeDasharray="3 3" />
          <text x="38" y="92" textAnchor="middle" fontFamily="Arial,sans-serif" fontWeight="700" fontSize="9" fill="#1a1406">% OFFRES %</text>
        </svg>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Décors de pied de page                                             */
/* ------------------------------------------------------------------ */

const SCENE_BG: Record<FestiveId, string> = {
  blackfriday: 'linear-gradient(to top,rgba(40,28,4,.72),rgba(40,28,4,.3) 55%,rgba(40,28,4,0))',
  noel: 'linear-gradient(to top,rgba(14,40,92,.7),rgba(30,70,140,.3) 55%,rgba(30,70,140,0))',
  nouvelan: 'linear-gradient(to top,rgba(30,12,80,.74),rgba(50,20,110,.32) 55%,rgba(50,20,110,0))',
  valentin: 'linear-gradient(to top,rgba(150,20,70,.55),rgba(255,92,138,.24) 55%,rgba(255,92,138,0))',
};

function Stars({ n, color = '#fff8d6', maxY = 70 }: { n: number; color?: string; maxY?: number }) {
  const stars = useMemo(
    () => Array.from({ length: n }, (_, i) => ({ x: ((i * 73 + 41) % 1580) + 10, y: ((i * 37) % maxY) + 8, r: i % 3 === 0 ? 1.8 : 1.2, d: (i % 7) * 0.45 })),
    [n, maxY],
  );
  return (
    <>
      {stars.map((s, i) => (
        <circle key={i} className="fs-star" style={{ animationDelay: `${s.d}s` }} cx={s.x} cy={s.y} r={s.r} fill={color} />
      ))}
    </>
  );
}

function Fir({ x, y, s, i }: { x: number; y: number; s: number; i: number }) {
  const lights = [[-10, -22], [9, -34], [-4, -48], [12, -16], [-14, -10], [3, -62]];
  const cols = ['#ff4d5a', '#ffd54a', '#7dd3fc', '#ff9ad5'];
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="-3" y="-4" width="6" height="8" fill="#4a2c14" />
      <path d="M0,-80 L16,-52 H8 L22,-30 H12 L28,-6 H-28 L-12,-30 H-22 L-8,-52 H-16Z" fill="#0f4a2d" />
      <path d="M0,-80 L7,-66 Q0,-62 -7,-66Z M-8,-52 L-3,-46 Q-8,-44 -12,-47Z M8,-52 L12,-47 Q8,-44 3,-46Z" fill="#fff" opacity=".9" />
      {lights.map(([lx, ly], k) => (
        <circle key={k} className="fs-win" style={{ animationDelay: `${((i + k) % 6) * 0.5}s` }} cx={lx} cy={ly} r="2.1" fill={cols[(i + k) % cols.length]} />
      ))}
      <path d="M0,-86 l2,5 5,.6 -4,3.6 1,5 -4,-2.6 -4,2.6 1,-5 -4,-3.6 5,-.6Z" fill="#ffd54a" />
    </g>
  );
}

function House({ x, y, s, flip }: { x: number; y: number; s: number; flip?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
      <rect x="-18" y="-24" width="36" height="24" fill="#3a2a22" />
      <path d="M-22,-24 L0,-42 L22,-24Z" fill="#fff" />
      <path d="M-22,-24 L0,-42 L22,-24" fill="none" stroke="#c9d9ec" strokeWidth="1.2" />
      <rect className="fs-win" x="-12" y="-18" width="8" height="9" fill="#ffd27a" />
      <rect className="fs-win" style={{ animationDelay: '1.3s' }} x="4" y="-18" width="8" height="9" fill="#ffd27a" />
      <rect x="12" y="-40" width="5" height="10" fill="#3a2a22" />
    </g>
  );
}

function SceneNoel() {
  return (
    <svg viewBox="0 0 1600 150" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <radialGradient id="fsMoon"><stop offset="0" stopColor="#fffbe0" stopOpacity=".7" /><stop offset="1" stopColor="#fffbe0" stopOpacity="0" /></radialGradient>
      </defs>
      <Stars n={26} color="#ffffff" />
      <circle className="fs-star" cx="250" cy="48" r="70" fill="url(#fsMoon)" />
      <circle cx="250" cy="48" r="24" fill="#fffbe6" />
      <circle cx="243" cy="42" r="4" fill="#efe6b8" opacity=".6" />
      <circle cx="257" cy="55" r="3" fill="#efe6b8" opacity=".55" />
      <path d="M0,150 L0,104 Q220,74 470,102 T920,96 T1300,104 T1600,90 L1600,150Z" fill="#b9cfe8" />
      <House x={1180} y={112} s={0.8} />
      <House x={470} y={118} s={0.65} flip />
      <Fir x={120} y={118} s={0.95} i={0} />
      <Fir x={190} y={122} s={0.62} i={2} />
      <Fir x={700} y={116} s={0.8} i={1} />
      <Fir x={1380} y={116} s={1.0} i={3} />
      <Fir x={1450} y={120} s={0.62} i={5} />
      <path d="M0,150 L0,122 Q260,100 520,120 T1040,114 T1600,112 L1600,150Z" fill="#dce9f6" />
      <Fir x={330} y={134} s={0.7} i={4} />
      <Fir x={960} y={134} s={0.82} i={6} />
      <Fir x={1560} y={134} s={0.7} i={7} />
      <path d="M0,150 L0,136 Q300,118 640,134 T1200,130 T1600,130 L1600,150Z" fill="#ffffff" />
    </svg>
  );
}

function SceneBlackFriday() {
  const bags = [
    [80, 122, 1.0], [250, 128, 0.78], [420, 120, 1.12], [610, 128, 0.86], [790, 124, 1.0],
    [980, 129, 0.8], [1150, 121, 1.1], [1330, 127, 0.84], [1500, 123, 1.0],
  ];
  return (
    <svg viewBox="0 0 1600 150" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <linearGradient id="fsBeam" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#ffe08a" stopOpacity=".5" /><stop offset="1" stopColor="#ffe08a" stopOpacity="0" /></linearGradient>
        <linearGradient id="fsBag" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#1f1a0e" /><stop offset=".5" stopColor="#2c2412" /><stop offset="1" stopColor="#15110a" /></linearGradient>
      </defs>
      <Stars n={14} color="#ffe9a8" maxY={60} />
      {[160, 520, 880, 1240].map((x, i) => (
        <path key={x} className="fs-beamr" style={{ animationDelay: `${i * 1.2}s` }} d={`M${x},150 L${x - 34},20 L${x + 34},20Z`} fill="url(#fsBeam)" />
      ))}
      {bags.map(([x, y, s], i) => (
        <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
          <path d="M-28,-2 L-24,-60 Q-24,-64 -20,-64 H20 Q24,-64 24,-60 L28,-2Z" fill="url(#fsBag)" stroke="#f5c451" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M-13,-64 C-13,-86 13,-86 13,-64" fill="none" stroke="#f5c451" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M-24,-52 H24" stroke="#f5c451" strokeWidth="1" opacity=".5" />
          {i % 3 === 0 && <text x="0" y="-26" textAnchor="middle" fontFamily="Arial Black,Arial,sans-serif" fontWeight="900" fontSize="13" fill="#f5c451">%</text>}
          {i % 3 === 1 && <path d="M0,-44 l3,7 7,.8 -5.4,4.8 1.6,7.2 -6.2,-3.8 -6.2,3.8 1.6,-7.2 -5.4,-4.8 7,-.8Z" fill="#f5c451" />}
        </g>
      ))}
      <rect x="0" y="140" width="1600" height="10" fill="#120e06" />
      <path d="M0,140 H1600" stroke="#f5c451" strokeWidth="1.6" opacity=".8" />
    </svg>
  );
}

function SceneNouvelAn() {
  const towers = useMemo(() => {
    const out: { x: number; w: number; h: number }[] = [];
    let x = 0;
    let i = 0;
    while (x < 1600) {
      const w = 36 + ((i * 29) % 46);
      const h = 34 + ((i * 53) % 74);
      out.push({ x, w, h });
      x += w + 4;
      i++;
    }
    return out;
  }, []);
  return (
    <svg viewBox="0 0 1600 150" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <Stars n={30} color="#fff3c4" maxY={80} />
      {[[300, 40, '#ffd36b'], [760, 30, '#f472b6'], [1220, 46, '#a78bfa']].map(([x, y, c], i) => (
        <g key={i} className="fs-star" style={{ animationDelay: `${i * 0.9}s` }} stroke={c as string} strokeWidth="1.6" strokeLinecap="round">
          {Array.from({ length: 10 }, (_, k) => {
            const a = (k / 10) * 6.283;
            return <path key={k} d={`M${x as number},${y as number} l${Math.cos(a) * 22},${Math.sin(a) * 22}`} opacity=".8" />;
          })}
        </g>
      ))}
      {towers.map((t, i) => (
        <g key={i}>
          <rect x={t.x} y={150 - t.h} width={t.w} height={t.h} fill={i % 2 ? '#150f33' : '#1c1442'} />
          {Array.from({ length: Math.floor(t.h / 14) }, (_, r) =>
            Array.from({ length: Math.max(1, Math.floor(t.w / 14)) }, (_, c) =>
              (i * 7 + r * 3 + c * 5) % 4 === 0 ? (
                <rect key={`${r}-${c}`} className="fs-win" style={{ animationDelay: `${((r + c + i) % 6) * 0.6}s` }} x={t.x + 6 + c * 12} y={150 - t.h + 6 + r * 13} width="5" height="6" fill="#ffd36b" />
              ) : null,
            ),
          )}
        </g>
      ))}
      {Array.from({ length: 16 }, (_, i) => (
        <circle key={i} className="fs-bub" style={{ animationDelay: `${(i * 0.7) % 9}s` }} cx={90 + i * 98} cy={146} r={2 + (i % 3)} fill="#ffe9a8" />
      ))}
    </svg>
  );
}

function Balloon({ x, y, s, c, d }: { x: number; y: number; s: number; c: string; d: number }) {
  return (
    <g className="fs-rise" style={{ animationDelay: `${d}s` }}>
      <g transform={`translate(${x} ${y}) scale(${s})`}>
        <path d="M0,6 C-9,-1 -8,-9 -3.4,-9 C-1.2,-9 0,-7 0,-6 C0,-7 1.2,-9 3.4,-9 C8,-9 9,-1 0,6Z" fill={c} transform="scale(3.4)" />
        <ellipse cx="-13" cy="-18" rx="5" ry="3.2" fill="#fff" opacity=".4" transform="rotate(-35 -13 -18)" />
        <path d="M0,20 q-6,14 0,28 q6,14 0,30" stroke="rgba(255,255,255,.7)" strokeWidth="1.2" fill="none" />
      </g>
    </g>
  );
}

function SceneValentin() {
  return (
    <svg viewBox="0 0 1600 150" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <Stars n={22} color="#ffe3ee" maxY={70} />
      <path d="M0,150 L0,100 Q240,66 500,98 T980,92 T1320,100 T1600,84 L1600,150Z" fill="#ffc2d6" />
      <Balloon x={210} y={56} s={0.62} c="#ff5c8a" d={0} />
      <Balloon x={540} y={44} s={0.82} c="#e11d62" d={-4} />
      <Balloon x={880} y={60} s={0.58} c="#ff9ebb" d={-8} />
      <Balloon x={1240} y={46} s={0.78} c="#ff5c8a" d={-2} />
      <Balloon x={1500} y={64} s={0.55} c="#e11d62" d={-6} />
      <path d="M0,150 L0,122 Q260,98 520,120 T1040,114 T1600,112 L1600,150Z" fill="#ff9dbb" />
      <path d="M0,150 L0,136 Q300,116 640,134 T1200,130 T1600,130 L1600,150Z" fill="#d6336c" />
    </svg>
  );
}

function Scene({ id, premium }: { id: FestiveId; premium: boolean }) {
  void premium;
  if (id === 'noel') return <SceneNoel />;
  if (id === 'blackfriday') return <SceneBlackFriday />;
  if (id === 'nouvelan') return <SceneNouvelAn />;
  return <SceneValentin />;
}

/* ------------------------------------------------------------------ */
/*  Bandeau offre + compte à rebours                                   */
/* ------------------------------------------------------------------ */

function Banner({ look, opt, preview, calm, premium }: { look: Look; opt: ThemeOptions['banner']; preview: boolean; calm: boolean; premium: boolean }) {
  const [closed, setClosed] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!preview) {
      try {
        if (sessionStorage.getItem(look.session) === '1') setClosed(true);
      } catch {
        /* stockage indisponible : le bandeau reste affiché */
      }
    }
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [preview, look.session]);

  const target = useMemo(
    () => new Date(`${opt.countdownDate}T${opt.countdownAt === 'start' ? '00:00:00' : '23:59:59'}`).getTime(),
    [opt.countdownDate, opt.countdownAt],
  );
  if (closed) return null;

  const left = now === null ? null : target - now;
  const done = left !== null && left <= 0;
  const pad = (n: number) => String(n).padStart(2, '0');
  let cd: ReactNode = null;
  if (left !== null && !done) {
    const s = Math.floor(left / 1000);
    cd = (
      <div className="cd" aria-label="Compte à rebours">
        <i>Plus que</i>
        <b key={`d${Math.floor(s / 86400)}`}>{Math.floor(s / 86400)}<small>j</small></b>
        <b key={`h${Math.floor((s % 86400) / 3600)}`}>{pad(Math.floor((s % 86400) / 3600))}<small>h</small></b>
        <b key={`m${Math.floor((s % 3600) / 60)}`}>{pad(Math.floor((s % 3600) / 60))}<small>m</small></b>
        <b key={`s${s % 60}`}>{pad(s % 60)}<small>s</small></b>
      </div>
    );
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(opt.code);
    } catch {
      const t = document.createElement('textarea');
      t.value = opt.code;
      document.body.appendChild(t);
      t.select();
      try { document.execCommand('copy'); } catch { /* rien */ }
      t.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const b = look.banner;
  const vars = {
    '--b1': b.bg1, '--b2': b.bg2, '--bd': b.border, '--bgl': b.glow, '--bt': b.text, '--bs': b.sub,
    '--c1': b.ctaFrom, '--c2': b.ctaTo, '--ctat': b.ctaText, '--cdbg': b.cdBg, '--cdbd': b.cdBd, '--cdt': b.cdText, '--conic': b.conic,
  } as CSSProperties;
  const href = safeHref(opt.ctaHref, '/boutique');
  return (
    <div className={`fs-banner${premium ? ' prem' : ''}${calm ? ' fs-calm' : ''}`} style={vars} role="region" aria-label={look.label}>
      <span className="pk" aria-hidden="true">{look.emoji}</span>
      <div className="tx">
        <div className="msg">{done && opt.countdownAt !== 'start' ? opt.countdownDoneText : opt.text}</div>
        {cd}
      </div>
      {opt.code && !done && (
        <button type="button" className="code" onClick={copy} title="Copier le code">
          {copied ? 'Copié ✓' : <>Code : {opt.code} <span aria-hidden="true">⧉</span></>}
        </button>
      )}
      {opt.ctaLabel && (
        href.startsWith('/') ? (
          <Link href={href} className="cta">{opt.ctaLabel}</Link>
        ) : (
          <a href={href} className="cta" rel="noopener noreferrer">{opt.ctaLabel}</a>
        )
      )}
      <button
        type="button"
        className="x"
        aria-label="Fermer le bandeau"
        onClick={() => {
          setClosed(true);
          if (!preview) {
            try { sessionStorage.setItem(look.session, '1'); } catch { /* rien */ }
          }
        }}
      >
        ✕
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Assemblage                                                         */
/* ------------------------------------------------------------------ */

const TOP_KEY: Partial<Record<FestiveId, 'lights' | 'pennants' | 'hangingHearts'>> = { noel: 'lights', nouvelan: 'pennants', valentin: 'hangingHearts' };
const TRAIL: Record<FestiveId, TrailShape> = { blackfriday: 'star', noel: 'snow', nouvelan: 'confetti', valentin: 'heart' };
const SCENE_KEY: Record<FestiveId, string> = { blackfriday: 'scene', noel: 'scene', nouvelan: 'scene', valentin: 'scene' };

export default function FestiveTheme({ themeId, options, preview, quiet = false }: Props) {
  const look = LOOKS[themeId];
  const env = useEnv(preview);
  const mult = MULT[options.intensity] ?? 1;
  const fx = options.effects;
  const on = (k: string) => fx[k] === true && !(quiet && QUIET_OFF.has(k));
  const motion = !env.calm; // le visiteur accepte les animations
  const canvasOk = motion && !env.lite;
  const pointerOk = canvasOk && env.fine;
  const prem = options.style === 'premium' && canvasOk;
  const dprCap = prem ? 2 : 1.5;

  const mouse = useMouse(prem && on('parallax') && pointerOk);
  const partRef = useRef<HTMLCanvasElement>(null);
  const part2Ref = useRef<HTMLCanvasElement>(null);
  const bokehRef = useRef<HTMLCanvasElement>(null);
  const fireRef = useRef<HTMLCanvasElement>(null);
  const trailRef = useRef<HTMLCanvasElement>(null);
  const sleighRef = useRef<HTMLDivElement>(null);

  const kind1: Kind | null = themeId === 'noel' ? 'snow' : themeId === 'blackfriday' ? 'glitter' : themeId === 'nouvelan' ? 'confetti' : 'hearts';
  const on1 = (themeId === 'noel' && on('snow')) || (themeId === 'blackfriday' && on('glitter')) || (themeId === 'nouvelan' && on('confetti')) || (themeId === 'valentin' && on('hearts'));
  const on2 = themeId === 'valentin' && on('petals');
  const onBokeh = prem && on('bokeh');
  const onFire = themeId === 'nouvelan' && on('fireworks');

  const common = { mult, mobile: env.mobile, premium: prem, mouse, bokeh: look.bokeh, bokehHeart: themeId === 'valentin' };
  useCanvasLoop(partRef, on1 && canvasOk, dprCap, particleSetup(kind1, common), [kind1, mult, env.mobile, prem, look]);
  useCanvasLoop(part2Ref, on2 && canvasOk, dprCap, particleSetup('petals', common), [mult, env.mobile, prem]);
  useCanvasLoop(bokehRef, onBokeh, dprCap, particleSetup('bokeh', common), [mult, env.mobile, look]);
  useCanvasLoop(fireRef, onFire && canvasOk, dprCap, fireworksSetup({ mult, mobile: env.mobile, premium: prem }), [mult, env.mobile, prem]);
  useCursorTrail(trailRef, on('cursorTrail') && pointerOk, TRAIL[themeId]);
  useSleigh(sleighRef, themeId === 'noel' && on('sleigh') && canvasOk, preview);
  useFavicon(on('favicon'), look.favicon);

  // marqueur sur <html> + pied de page pour le décor + haut de page pour la guirlande
  const [footer, setFooter] = useState<HTMLElement | null>(null);
  useEffect(() => {
    document.documentElement.setAttribute('data-season', themeId);
    return () => document.documentElement.removeAttribute('data-season');
  }, [themeId]);
  const scene = on(SCENE_KEY[themeId]);
  useEffect(() => {
    if (!scene) { setFooter(null); return; }
    const f = document.querySelector<HTMLElement>('footer');
    if (!f) return;
    f.classList.add('fs-footer');
    setFooter(f);
    return () => {
      f.classList.remove('fs-footer');
      setFooter(null);
    };
  }, [scene]);

  const topKind = TOP_KEY[themeId];
  const topOn = !!topKind && on(themeId === 'noel' ? 'lights' : themeId === 'nouvelan' ? 'pennants' : 'hangingHearts');
  const [bodyEl, setBodyEl] = useState<HTMLElement | null>(null);
  useEffect(() => setBodyEl(document.body), []);

  const rootStyle = {
    '--vig': look.vig, '--vigp': look.vigPrem, '--strip': look.strip, '--stripglow': look.stripGlow,
  } as CSSProperties;
  const vigOn = on(themeId === 'noel' ? 'frost' : themeId === 'blackfriday' ? 'vignette' : 'glow');

  return (
    <>
      <style>{CSS}</style>

      <div className={`fs-root${prem ? ' prem' : ''}${env.calm ? ' fs-calm' : ''}`} style={rootStyle} aria-hidden="true">
        {vigOn && (<><div className="fs-vig" /><div className="fs-strip" /></>)}
        {themeId === 'noel' && on('aurora') && prem && (<div className="fs-aurora"><i /><i /><i /></div>)}
        {themeId === 'blackfriday' && on('shine') && motion && <div className="fs-shine" />}
        {themeId === 'blackfriday' && on('spotlights') && prem && (<><div className="fs-beam l" /><div className="fs-beam r" /></>)}
        {on1 && canvasOk && <canvas ref={partRef} className="fs-canvas" />}
        {on2 && canvasOk && <canvas ref={part2Ref} className="fs-canvas" />}
        {onFire && canvasOk && <canvas ref={fireRef} className="fs-canvas" />}
        {themeId === 'blackfriday' && on('tag') && !env.lite && <Tag />}
        {themeId === 'noel' && on('sleigh') && canvasOk && <div ref={sleighRef} style={{ position: 'absolute', inset: 0 }} />}
        {on('cursorTrail') && pointerOk && <canvas ref={trailRef} className="fs-canvas" />}
        {onBokeh && <canvas ref={bokehRef} className="fs-canvas" />}
      </div>

      {topOn && topKind && bodyEl &&
        createPortal(
          <div className={`fs-top${env.calm ? ' fs-calm' : ''}`} aria-hidden="true">
            <TopString kind={topKind} width={env.width} />
          </div>,
          bodyEl,
        )}

      {footer &&
        createPortal(
          <div className={`fs-scene${prem ? ' prem' : ''}${env.calm ? ' fs-calm' : ''}`} style={{ '--scene': SCENE_BG[themeId] } as CSSProperties} aria-hidden="true">
            <Scene id={themeId} premium={prem} />
          </div>,
          footer,
        )}

      {on('banner') && <Banner look={look} opt={options.banner} preview={preview} calm={env.calm} premium={prem} />}
    </>
  );
}
