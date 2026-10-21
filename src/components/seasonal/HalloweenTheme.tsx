'use client';

// Thème saisonnier HALLOWEEN. Monté par SeasonalTheme.tsx uniquement quand le thème est actif
// (ou en aperçu depuis /admin/themes). Aucun élément ne capte la souris ni ne décale la mise en page :
// tout est en position fixe/absolue avec pointer-events:none, donc le site reste utilisable et le
// score "Core Web Vitals" ne bouge pas.
//
// Règles de sobriété (accessibilité / performance) :
//  - "Réduire les animations" activé chez le visiteur => décor FIXE seulement (aucun mouvement).
//  - Mode économie de données => pas d'animations canvas (braises, étincelles, fantôme).
//  - Téléphone : moins de particules, pas d'effets "souris".
//  - Onglet masqué : rien ne tourne (requestAnimationFrame se met en pause tout seul).

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { safeHref, type ThemeOptions } from '@/lib/seasonalThemes';

type Props = { options: ThemeOptions; preview: boolean; quiet?: boolean };

// Effets coupés sur les pages de paiement (panier / checkout)
const QUIET_OFF = new Set(['banner', 'spider', 'bats', 'ghost', 'cursorTrail', 'lightning', 'embers']);

const MULT = { doux: 0.55, normal: 1, intense: 1.7 } as const;

/* ------------------------------------------------------------------ */
/*  Détection de l'environnement du visiteur                           */
/* ------------------------------------------------------------------ */

function useEnv(preview: boolean) {
  const [env, setEnv] = useState({ calm: false, lite: false, mobile: false, fine: true });
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
html[data-season="halloween"] ::selection{background:#ff7a00;color:#fff}
.hw-root{position:fixed;inset:0;pointer-events:none;z-index:45;overflow:hidden}
.hw-root *{pointer-events:none}

/* Lueur nocturne */
.hw-vig{position:absolute;inset:0;background:
  radial-gradient(ellipse at 50% 42%,rgba(0,0,0,0) 56%,rgba(58,20,104,.16) 80%,rgba(28,8,56,.34) 100%),
  radial-gradient(ellipse 70% 30% at 50% 108%,rgba(255,122,0,.20),rgba(255,122,0,0) 70%)}
.hw-strip{position:absolute;left:0;right:0;top:0;height:3px;
  background:linear-gradient(90deg,#ff7a00,#ff3d00,#8b5cf6,#ff7a00,#ff3d00);background-size:300% 100%;
  box-shadow:0 0 14px rgba(255,122,0,.65);animation:hw-strip 9s linear infinite}
@keyframes hw-strip{to{background-position:-300% 0}}

/* Brume */
.hw-fog{position:absolute;left:-50%;width:200%;bottom:0;height:34vh;opacity:.85;
  -webkit-mask-image:linear-gradient(to top,#000 25%,transparent);mask-image:linear-gradient(to top,#000 25%,transparent);
  background:
   radial-gradient(ellipse 14% 46% at 12% 70%,rgba(124,84,200,.36),transparent 72%),
   radial-gradient(ellipse 18% 40% at 33% 60%,rgba(160,120,225,.30),transparent 72%),
   radial-gradient(ellipse 15% 50% at 58% 72%,rgba(118,78,190,.34),transparent 72%),
   radial-gradient(ellipse 18% 42% at 80% 62%,rgba(150,108,215,.30),transparent 72%),
   radial-gradient(ellipse 12% 46% at 96% 74%,rgba(124,84,200,.34),transparent 72%);
  animation:hw-fog 58s ease-in-out infinite alternate}
.hw-fog.b{height:22vh;opacity:.8;animation-duration:84s;animation-direction:alternate-reverse}
@keyframes hw-fog{from{transform:translateX(-4%)}to{transform:translateX(24%)}}

/* Toiles */
.hw-web{position:absolute;top:0;width:150px;height:150px;opacity:.75}
.hw-web.l{left:0}
.hw-web.r{right:0;transform:scaleX(-1)}

/* Araignée */
.hw-spider{position:absolute;top:0;right:5.5%;width:46px;display:flex;flex-direction:column;align-items:center;
  transform:translateY(-100%);animation:hw-spider 26s ease-in-out infinite}
.hw-spider .th{width:1.6px;height:170px;background:linear-gradient(rgba(70,60,95,.0),rgba(70,60,95,.85) 30%)}
.hw-spider .sw{transform-origin:50% 0;animation:hw-sway 3.4s ease-in-out infinite alternate;display:flex;flex-direction:column;align-items:center}
.hw-spider .legs{transform-origin:0 4px;animation:hw-legs .45s ease-in-out infinite alternate}
@keyframes hw-spider{
  0%,5%{transform:translateY(-100%)}
  9%{transform:translateY(-44%)} 12%{transform:translateY(-40%)}
  16%{transform:translateY(-14%)} 18%{transform:translateY(-12%)}
  22%{transform:translateY(0)} 25%{transform:translateY(-3%)} 28%,58%{transform:translateY(0)}
  68%{transform:translateY(-100%)} 100%{transform:translateY(-100%)}}
@keyframes hw-sway{from{transform:rotate(-4deg)}to{transform:rotate(4deg)}}
@keyframes hw-legs{from{transform:scale(1,1)}to{transform:scale(1.07,.95)}}

/* Chauves-souris */
.hw-bat{position:absolute;left:0;top:0;will-change:transform;transform:translate(-200px,0)}
.hw-wing{transform-box:fill-box;transform-origin:0% 55%;animation:hw-flap var(--flap,.18s) ease-in-out infinite alternate}
@keyframes hw-flap{from{transform:rotate(-34deg) scaleY(1)}to{transform:rotate(28deg) scaleY(.8)}}

/* Fantôme */
.hw-ghost{position:absolute;left:0;top:0;width:40px;opacity:0;transition:opacity .4s;will-change:transform}
.hw-ghost.on{opacity:.95}
.hw-ghost svg{display:block;filter:drop-shadow(0 6px 10px rgba(91,33,182,.35));animation:hw-bob 2.2s ease-in-out infinite alternate}
@keyframes hw-bob{from{transform:translateY(-3px) rotate(-3deg)}to{transform:translateY(4px) rotate(3deg)}}

.hw-canvas{position:absolute;inset:0;width:100%;height:100%}
.hw-flash{position:absolute;inset:0;opacity:0;background:radial-gradient(ellipse at 50% 20%,rgba(235,225,255,.95),rgba(190,170,255,.55) 55%,rgba(120,90,200,.2))}

/* Cimetière (inséré dans le footer) */
footer.hw-footer{position:relative;margin-top:7rem !important}
.hw-grave{position:absolute;left:0;right:0;bottom:100%;height:clamp(120px,11.5vw,220px);pointer-events:none;overflow:hidden;
  background:linear-gradient(to top,rgba(52,26,104,.62),rgba(52,26,104,.28) 55%,rgba(52,26,104,0))}
.hw-grave svg{position:absolute;inset:0;width:100%;height:100%;display:block}
.hw-flick{animation:hw-flick 3.2s infinite}
.hw-flick.b{animation-duration:2.6s;animation-delay:-.9s}
.hw-flick.c{animation-duration:3.9s;animation-delay:-1.7s}
@keyframes hw-flick{0%,100%{opacity:1}8%{opacity:.78}14%{opacity:1}31%{opacity:.86}38%{opacity:.7}43%{opacity:1}67%{opacity:.9}74%{opacity:.74}80%{opacity:1}}
.hw-star{animation:hw-tw 3s ease-in-out infinite alternate}
@keyframes hw-tw{from{opacity:.25}to{opacity:1}}
.hw-moonglow{animation:hw-moon 7s ease-in-out infinite alternate}
@keyframes hw-moon{from{opacity:.55}to{opacity:.9}}

/* Bandeau offre */
.hw-banner{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:49;width:min(94vw,760px);
  display:flex;align-items:center;gap:14px;padding:10px 12px 10px 14px;border-radius:18px;color:#fff;
  background:linear-gradient(135deg,rgba(26,12,46,.95),rgba(48,16,70,.95));backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);
  border:1px solid rgba(255,140,40,.6);box-shadow:0 14px 44px rgba(10,0,30,.45),0 0 28px rgba(255,122,0,.28);
  pointer-events:auto;animation:hw-pop .7s cubic-bezier(.2,1.3,.4,1) both}
.hw-banner *{pointer-events:auto}
@keyframes hw-pop{from{opacity:0;transform:translateX(-50%) translateY(30px) scale(.94)}to{opacity:1;transform:translateX(-50%)}}
.hw-banner .pk{font-size:30px;line-height:1;filter:drop-shadow(0 0 10px rgba(255,140,30,.9));animation:hw-bob 2.4s ease-in-out infinite alternate;flex:none}
.hw-banner .tx{flex:1;min-width:0}
.hw-banner .msg{font-weight:700;font-size:14px;line-height:1.25;text-shadow:0 0 14px rgba(255,140,30,.55);animation:hw-neon 5s infinite}
@keyframes hw-neon{0%,18%,22%,62%,100%{opacity:1}20%{opacity:.75}64%{opacity:.82}66%{opacity:1}}
.hw-banner .cd{display:flex;gap:6px;margin-top:6px;align-items:center;font-size:11px;color:#e9d5ff}
.hw-banner .cd b{display:inline-block;min-width:30px;text-align:center;padding:2px 5px;border-radius:7px;background:rgba(255,122,0,.18);
  border:1px solid rgba(255,150,50,.5);color:#ffd9a8;font:700 14px/1.15 ui-monospace,SFMono-Regular,Menlo,monospace;font-variant-numeric:tabular-nums}
.hw-banner .cd i{font-style:normal;margin-right:4px;opacity:.85}
.hw-banner .code{flex:none;display:flex;align-items:center;gap:6px;border:1px dashed rgba(255,190,110,.85);border-radius:10px;padding:5px 9px;
  background:rgba(255,255,255,.07);color:#ffe2b8;font:700 12px/1 ui-monospace,SFMono-Regular,Menlo,monospace;cursor:pointer;letter-spacing:.04em}
.hw-banner .code:hover{background:rgba(255,255,255,.14)}
.hw-banner .cta{flex:none;border-radius:11px;padding:9px 14px;font-weight:700;font-size:13px;color:#2a1200;text-decoration:none;
  background:linear-gradient(135deg,#ffb347,#ff7a00);box-shadow:0 4px 14px rgba(255,122,0,.45);transition:transform .15s}
.hw-banner .cta:hover{transform:translateY(-1px) scale(1.03)}
.hw-banner .x{flex:none;width:26px;height:26px;border-radius:50%;border:0;background:rgba(255,255,255,.1);color:#fff;font-size:13px;cursor:pointer;line-height:1}
.hw-banner .x:hover{background:rgba(255,255,255,.22)}
@media (max-width:639px){
  .hw-banner{bottom:84px;flex-wrap:wrap;gap:8px 10px;padding:10px 12px;border-radius:16px}
  .hw-banner .pk{font-size:24px}
  .hw-banner .tx{flex:1 1 calc(100% - 72px)}
  .hw-banner .msg{font-size:12.5px}
  .hw-banner .code,.hw-banner .cta{flex:1 1 auto;text-align:center;justify-content:center}
  .hw-banner .x{position:absolute;top:-8px;right:-4px;background:#2b1348;border:1px solid rgba(255,150,50,.6)}
  .hw-web{width:96px;height:96px}
  .hw-spider{transform-origin:top;scale:.8}
}

/* Visiteur qui demande moins d'animations : décor figé */
.hw-calm *,.hw-calm{animation:none !important}
.hw-calm .hw-spider{display:none}
`;

/* ------------------------------------------------------------------ */
/*  Petits dessins SVG                                                 */
/* ------------------------------------------------------------------ */

const BAT_SVG =
  '<svg viewBox="-34 -16 68 32" width="100%" style="display:block;overflow:visible" aria-hidden="true">' +
  '<g fill="#1a1426">' +
  '<g class="hw-wing"><path d="M3,-2 C9,-15 22,-15 33,-7 C29,-6 27,-3 26,0 C23,-3 19,-2 17,2 C14,-1 10,0 8,4 C6,2 4,3 3,2Z"/></g>' +
  '<g transform="scale(-1,1)"><g class="hw-wing"><path d="M3,-2 C9,-15 22,-15 33,-7 C29,-6 27,-3 26,0 C23,-3 19,-2 17,2 C14,-1 10,0 8,4 C6,2 4,3 3,2Z"/></g></g>' +
  '<path d="M-3.6,-3 L-3,-9.5 L-0.8,-5.6 L0.8,-5.6 L3,-9.5 L3.6,-3 Q3.8,3 0,8.5 Q-3.8,3 -3.6,-3Z"/>' +
  '<circle cx="-1.3" cy="-2.4" r=".7" fill="#ff5a3c"/><circle cx="1.3" cy="-2.4" r=".7" fill="#ff5a3c"/>' +
  '</g></svg>';

function webPath(S: number) {
  const rays = 7;
  const pt = (r: number, i: number): [number, number] => [
    Math.cos((i / (rays - 1)) * (Math.PI / 2)) * r,
    Math.sin((i / (rays - 1)) * (Math.PI / 2)) * r,
  ];
  let d = '';
  for (let i = 0; i < rays; i++) {
    const [x, y] = pt(S, i);
    d += `M0,0 L${x.toFixed(1)},${y.toFixed(1)} `;
  }
  for (const k of [0.2, 0.38, 0.57, 0.77, 1]) {
    const r = S * k;
    for (let i = 0; i < rays - 1; i++) {
      const [x1, y1] = pt(r, i);
      const [x2, y2] = pt(r, i + 1);
      const cx = ((x1 + x2) / 2) * 0.8;
      const cy = ((y1 + y2) / 2) * 0.8;
      d += `M${x1.toFixed(1)},${y1.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)} `;
    }
  }
  return d;
}

function Web({ side }: { side: 'l' | 'r' }) {
  return (
    <svg className={`hw-web ${side}`} viewBox="0 0 150 150" aria-hidden="true">
      <path d={webPath(148)} fill="none" stroke="rgba(66,56,92,.5)" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

function Spider() {
  const legs = [
    'M-3,-2 Q-9,-13 -17,-12 L-20,-6',
    'M-3,0 Q-11,-7 -19,-3 L-21,4',
    'M-3,2 Q-11,2 -18,7 L-19,13',
    'M-3,4 Q-8,9 -14,13 L-14,17',
  ];
  return (
    <div className="hw-spider">
      <div className="th" />
      <div className="sw">
        <svg viewBox="-23 -10 46 36" width="46" height="36" aria-hidden="true" style={{ display: 'block', marginTop: -2 }}>
          <g className="legs" stroke="#241d38" strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round">
            {legs.map((d, i) => (
              <g key={i}>
                <path d={d} />
                <path d={d} transform="scale(-1,1)" />
              </g>
            ))}
          </g>
          <ellipse cx="0" cy="8" rx="7" ry="9" fill="#1b1530" />
          <circle cx="0" cy="-3" r="4.6" fill="#241d38" />
          <path d="M-2.2,3 L2.2,3 L0,8 L2.2,13 L-2.2,13 L0,8Z" fill="#ff5a1f" />
          <circle cx="-1.7" cy="-4.4" r="1" fill="#ff3b3b" />
          <circle cx="1.7" cy="-4.4" r="1" fill="#ff3b3b" />
        </svg>
      </div>
    </div>
  );
}

function Ghost() {
  return (
    <svg viewBox="0 0 40 48" width="40" height="48" aria-hidden="true">
      <path
        d="M20,2 C9,2 4,10 4,20 L4,44 L10,39 L15,45 L20,39 L25,45 L30,39 L36,44 L36,20 C36,10 31,2 20,2Z"
        fill="#ffffff"
        stroke="#c4b5fd"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <ellipse cx="14" cy="19" rx="3" ry="4.2" fill="#1b1530" />
      <ellipse cx="26" cy="19" rx="3" ry="4.2" fill="#1b1530" />
      <ellipse cx="20" cy="29" rx="3.2" ry="4" fill="#1b1530" />
      <circle cx="9" cy="26" r="3" fill="#fbcfe8" opacity=".7" />
      <circle cx="31" cy="26" r="3" fill="#fbcfe8" opacity=".7" />
    </svg>
  );
}

function Pumpkin({ x, y, s, cls }: { x: number; y: number; s: number; cls: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <circle cx="0" cy="-22" r="62" fill="url(#hwGlow)" className={`hw-flick ${cls}`} />
      <ellipse cx="-17" cy="-24" rx="22" ry="25" fill="url(#hwPumpkin)" />
      <ellipse cx="17" cy="-24" rx="22" ry="25" fill="url(#hwPumpkin)" />
      <ellipse cx="0" cy="-24" rx="23" ry="27" fill="url(#hwPumpkin)" />
      <path d="M-3,-50 Q-2,-62 7,-62 L9,-57 Q3,-56 3,-50Z" fill="#4d7c0f" />
      <g className={`hw-flick ${cls}`} fill="#ffe08a">
        <path d="M-17,-28 L-7,-28 L-12,-39Z" />
        <path d="M7,-28 L17,-28 L12,-39Z" />
        <path d="M-16,-16 L-10,-20 L-5,-14 L0,-20 L5,-14 L10,-20 L16,-16 Q10,-2 0,-2 Q-10,-2 -16,-16Z" />
      </g>
    </g>
  );
}

function Tomb({ x, y, w, h, cross }: { x: number; y: number; w: number; h: number; cross?: boolean }) {
  const r = w / 2;
  return (
    <g>
      <path d={`M${x},${y + h} V${y + r} A${r},${r} 0 0 1 ${x + w},${y + r} V${y + h} Z`} fill="#111827" />
      {cross && (
        <path
          d={`M${x + r},${y + 9} v${h * 0.4} M${x + r - 6},${y + 18} h12`}
          stroke="#243044"
          strokeWidth="2.4"
          strokeLinecap="round"
          fill="none"
        />
      )}
    </g>
  );
}

function Graveyard() {
  const stars = useMemo(
    () => Array.from({ length: 22 }, (_, i) => ({ x: (i * 73 + 41) % 1580 + 10, y: (i * 37) % 70 + 8, r: i % 3 === 0 ? 1.8 : 1.2, d: (i % 7) * 0.45 })),
    [],
  );
  return (
    <svg viewBox="0 0 1600 150" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <radialGradient id="hwGlow">
          <stop offset="0" stopColor="#ff9a2a" stopOpacity=".55" />
          <stop offset=".5" stopColor="#ff7a00" stopOpacity=".18" />
          <stop offset="1" stopColor="#ff7a00" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="hwMoonGlow">
          <stop offset="0" stopColor="#fff3b0" stopOpacity=".7" />
          <stop offset="1" stopColor="#fff3b0" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="hwPumpkin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffa43a" />
          <stop offset="1" stopColor="#d84a00" />
        </linearGradient>
      </defs>

      {stars.map((s, i) => (
        <circle key={i} className="hw-star" style={{ animationDelay: `${s.d}s` }} cx={s.x} cy={s.y} r={s.r} fill="#fff8d6" />
      ))}

      <circle className="hw-moonglow" cx="1340" cy="52" r="74" fill="url(#hwMoonGlow)" />
      <circle cx="1340" cy="52" r="27" fill="#fdf0a6" />
      <circle cx="1331" cy="45" r="5" fill="#f1dc7e" opacity=".7" />
      <circle cx="1350" cy="62" r="3.4" fill="#f1dc7e" opacity=".7" />
      <circle cx="1348" cy="41" r="2.4" fill="#f1dc7e" opacity=".6" />

      {/* collines (arrière → avant) */}
      <path d="M0,150 L0,104 Q220,70 460,100 T900,94 T1300,102 T1600,86 L1600,150Z" fill="#2a1d52" />
      <path d="M0,150 L0,120 Q260,96 520,118 T1040,112 T1600,110 L1600,150Z" fill="#1c1338" />
      <path d="M0,150 L0,134 Q300,114 620,132 T1180,128 T1600,128 L1600,150Z" fill="#111827" />

      {/* arbre mort */}
      <g transform="translate(120 0)" stroke="#1c1338" strokeLinecap="round" fill="none">
        <path d="M176,128 C173,100 181,82 177,52" strokeWidth="9" />
        <path d="M177,86 C156,78 142,64 124,60" strokeWidth="4.5" />
        <path d="M178,72 C196,62 210,58 228,44" strokeWidth="4.5" />
        <path d="M177,58 C172,44 163,38 156,24" strokeWidth="3.8" />
        <path d="M130,62 C124,52 118,50 110,46" strokeWidth="2.6" />
        <path d="M214,54 C220,48 224,36 232,32" strokeWidth="2.6" />
        <path d="M159,30 C166,24 170,14 168,8" strokeWidth="2.4" />
      </g>

      {/* tombes (arrière) */}
      <g fill="#1c1338">
        <path d="M330,128 V104 A12,12 0 0 1 354,104 V128Z" />
        <path d="M1030,126 V100 A13,13 0 0 1 1056,100 V126Z" />
        <path d="M1480,124 V98 A12,12 0 0 1 1504,98 V124Z" />
      </g>

      <Pumpkin x={560} y={140} s={0.62} cls="a" />
      <Pumpkin x={846} y={141} s={0.9} cls="b" />
      <Pumpkin x={940} y={142} s={0.48} cls="c" />
      <Pumpkin x={1210} y={140} s={0.7} cls="b" />

      {/* tombes (avant) */}
      <Tomb x={246} y={106} w={28} h={34} cross />
      <Tomb x={690} y={112} w={26} h={30} />
      <Tomb x={1120} y={108} w={30} h={34} cross />
      <Tomb x={1400} y={110} w={28} h={32} />
      <g stroke="#111827" strokeWidth="5" strokeLinecap="round">
        <path d="M418,142 V104 M406,114 H430" />
        <path d="M1300,142 V108 M1289,117 H1311" />
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Bandeau offre + compte à rebours                                   */
/* ------------------------------------------------------------------ */

function Banner({ opt, preview, calm }: { opt: ThemeOptions['banner']; preview: boolean; calm: boolean }) {
  const [closed, setClosed] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!preview) {
      try {
        if (sessionStorage.getItem('hw_banner_closed') === '1') setClosed(true);
      } catch {
        /* stockage indisponible : le bandeau reste affiché */
      }
    }
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [preview]);

  const target = useMemo(() => new Date(`${opt.countdownDate}T23:59:59`).getTime(), [opt.countdownDate]);
  if (closed) return null;

  const left = now === null ? null : target - now;
  const done = left !== null && left <= 0;
  const pad = (n: number) => String(n).padStart(2, '0');
  let cd: React.ReactNode = null;
  if (left !== null && !done) {
    const s = Math.floor(left / 1000);
    cd = (
      <div className="cd" aria-label="Compte à rebours">
        <i>Plus que</i>
        <b>{Math.floor(s / 86400)}<small>j</small></b>
        <b>{pad(Math.floor((s % 86400) / 3600))}<small>h</small></b>
        <b>{pad(Math.floor((s % 3600) / 60))}<small>m</small></b>
        <b>{pad(s % 60)}<small>s</small></b>
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

  const href = safeHref(opt.ctaHref, '/boutique');
  return (
    <div className={`hw-banner${calm ? ' hw-calm' : ''}`} role="region" aria-label="Offre Halloween">
      <span className="pk" aria-hidden="true">🎃</span>
      <div className="tx">
        <div className="msg">{done ? opt.countdownDoneText : opt.text}</div>
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
            try { sessionStorage.setItem('hw_banner_closed', '1'); } catch { /* rien */ }
          }
        }}
      >
        ✕
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Effets impératifs (chauves-souris, braises, étincelles, éclairs…)  */
/* ------------------------------------------------------------------ */

function useBats(host: React.RefObject<HTMLDivElement | null>, on: boolean, mult: number, mobile: boolean, preview: boolean) {
  useEffect(() => {
    const el = host.current;
    if (!on || !el) return;
    const anims = new Set<Animation>();
    let timer: ReturnType<typeof setTimeout>;
    let alive = true;
    const maxAtOnce = Math.max(1, Math.round(2.2 * mult));

    const spawn = () => {
      if (document.hidden || anims.size >= maxAtOnce) return;
      const W = window.innerWidth;
      const H = window.innerHeight;
      const dir = Math.random() < 0.5 ? 1 : -1;
      const size = (28 + Math.random() * 34) * (mobile ? 0.85 : 1);
      const bat = document.createElement('div');
      bat.className = 'hw-bat';
      bat.style.width = `${size}px`;
      bat.style.setProperty('--flap', `${(0.14 + Math.random() * 0.1).toFixed(2)}s`);
      bat.innerHTML = BAT_SVG;
      if (dir < 0) (bat.firstElementChild as SVGElement).style.transform = 'scaleX(-1)';
      el.appendChild(bat);

      const x0 = dir > 0 ? -size - 30 : W + 30;
      const x1 = dir > 0 ? W + 30 : -size - 30;
      const y0 = H * (0.1 + Math.random() * 0.5);
      const amp = 18 + Math.random() * 46;
      const wob = 2 + Math.random() * 1.6;
      const ph = Math.random() * Math.PI * 2;
      const n = 14;
      const frames: Keyframe[] = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const x = x0 + (x1 - x0) * t;
        const y = y0 + Math.sin(t * Math.PI * wob + ph) * amp - t * H * 0.05;
        const dy = Math.cos(t * Math.PI * wob + ph) * amp * Math.PI * wob;
        const ang = dir * Math.atan2(dy, Math.abs(x1 - x0)) * (180 / Math.PI) * 1.2;
        frames.push({ transform: `translate(${x.toFixed(0)}px,${y.toFixed(0)}px) rotate(${Math.max(-25, Math.min(25, ang)).toFixed(1)}deg)`, offset: t });
      }
      const dur = (5800 + Math.random() * 5200) * (size > 48 ? 1.12 : 1) * (W < 700 ? 0.8 : 1);
      const a = bat.animate(frames, { duration: dur, easing: 'linear', fill: 'forwards' });
      anims.add(a);
      a.onfinish = () => {
        anims.delete(a);
        bat.remove();
      };
    };

    const loop = () => {
      if (!alive) return;
      spawn();
      if (Math.random() < 0.18 * mult) setTimeout(spawn, 350); // petite escadrille
      timer = setTimeout(loop, (2800 + Math.random() * 5200) / mult);
    };
    timer = setTimeout(loop, preview ? 400 : 1500);

    return () => {
      alive = false;
      clearTimeout(timer);
      anims.forEach((a) => a.cancel());
      anims.clear();
      el.querySelectorAll('.hw-bat').forEach((n) => n.remove());
    };
  }, [host, on, mult, mobile, preview]);
}

function useEmbers(canvasRef: React.RefObject<HTMLCanvasElement | null>, on: boolean, mult: number, mobile: boolean) {
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

    const sprite = document.createElement('canvas');
    sprite.width = sprite.height = 48;
    const sc = sprite.getContext('2d')!;
    const g = sc.createRadialGradient(24, 24, 0, 24, 24, 24);
    g.addColorStop(0, 'rgba(255,236,160,1)');
    g.addColorStop(0.25, 'rgba(255,165,50,.9)');
    g.addColorStop(0.6, 'rgba(255,104,0,.28)');
    g.addColorStop(1, 'rgba(255,90,0,0)');
    sc.fillStyle = g;
    sc.fillRect(0, 0, 48, 48);

    const count = Math.round((mobile ? 14 : 30) * mult);
    type P = { x: number; y: number; vy: number; vx: number; s: number; ph: number; f: number };
    const mk = (anywhere: boolean): P => ({
      x: Math.random() * w,
      y: anywhere ? Math.random() * h : h + 20 + Math.random() * 60,
      vy: -(0.22 + Math.random() * 0.55),
      vx: (Math.random() - 0.5) * 0.15,
      s: 3 + Math.random() * 6,
      ph: Math.random() * 6.28,
      f: 0.8 + Math.random() * 1.6,
    });
    const ps: P[] = Array.from({ length: count }, () => mk(true));

    let raf = 0;
    const frame = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      const sec = t / 1000;
      for (const p of ps) {
        p.y += p.vy;
        p.x += p.vx + Math.sin(sec * p.f + p.ph) * 0.35;
        if (p.y < -20) Object.assign(p, mk(false));
        const tw = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(sec * p.f * 2.4 + p.ph));
        const fade = Math.min(1, p.y / (h * 0.35));
        ctx.globalAlpha = Math.max(0, tw * fade * 0.9);
        ctx.drawImage(sprite, p.x - p.s, p.y - p.s, p.s * 2, p.s * 2);
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      ctx.clearRect(0, 0, w, h);
    };
  }, [canvasRef, on, mult, mobile]);
}

function useCursorTrail(canvasRef: React.RefObject<HTMLCanvasElement | null>, on: boolean) {
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

    type S = { x: number; y: number; vx: number; vy: number; life: number; max: number; r: number; hue: number };
    const sparks: S[] = [];
    let raf = 0;
    let lastX = 0;
    let lastY = 0;

    const frame = () => {
      ctx.clearRect(0, 0, w, h);
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.life += 16;
        s.x += s.vx;
        s.y += s.vy;
        s.vy += 0.03;
        const k = 1 - s.life / s.max;
        if (k <= 0) { sparks.splice(i, 1); continue; }
        ctx.globalAlpha = k;
        ctx.fillStyle = `hsl(${s.hue},100%,58%)`;
        ctx.shadowColor = `hsl(${s.hue},100%,55%)`;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * k + 0.4, 0, 6.283);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
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
          vx: (Math.random() - 0.5) * 1.2, vy: (Math.random() - 0.8) * 1.2,
          life: 0, max: 520 + Math.random() * 380, r: 1.6 + Math.random() * 2.2,
          hue: 22 + Math.random() * 24,
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
  }, [canvasRef, on]);
}

function useGhost(ref: React.RefObject<HTMLDivElement | null>, on: boolean) {
  useEffect(() => {
    const el = ref.current;
    if (!on || !el) return;
    let tx = -100;
    let ty = -100;
    let x = -100;
    let y = -100;
    let raf = 0;
    let started = false;
    let idle: ReturnType<typeof setTimeout>;
    const loop = () => {
      const px = x;
      x += (tx + 22 - x) * 0.07;
      y += (ty + 16 - y) * 0.07;
      const flip = x < px - 0.2 ? -1 : 1;
      el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) scaleX(${flip})`;
      raf = requestAnimationFrame(loop);
    };
    const move = (e: MouseEvent) => {
      tx = e.clientX;
      ty = e.clientY;
      if (!started) {
        started = true;
        x = tx;
        y = ty;
        raf = requestAnimationFrame(loop);
      }
      el.classList.add('on');
      clearTimeout(idle);
      idle = setTimeout(() => el.classList.remove('on'), 6000);
    };
    window.addEventListener('mousemove', move, { passive: true });
    return () => {
      window.removeEventListener('mousemove', move);
      clearTimeout(idle);
      if (raf) cancelAnimationFrame(raf);
      el.classList.remove('on');
    };
  }, [ref, on]);
}

function useLightning(ref: React.RefObject<HTMLDivElement | null>, on: boolean, preview: boolean) {
  useEffect(() => {
    const el = ref.current;
    if (!on || !el) return;
    let timer: ReturnType<typeof setTimeout>;
    let alive = true;
    const strike = () => {
      if (!alive) return;
      if (!document.hidden) {
        // Deux lueurs très faibles espacées de ~0,2 s, puis plus rien pendant 30 à 60 s (bien sous le seuil de 3 flashs/s).
        el.animate(
          [
            { opacity: 0 },
            { opacity: 0.16, offset: 0.07 },
            { opacity: 0.02, offset: 0.2 },
            { opacity: 0.1, offset: 0.27 },
            { opacity: 0 },
          ],
          { duration: 1100, easing: 'ease-out' },
        );
      }
      timer = setTimeout(strike, 30000 + Math.random() * 30000);
    };
    timer = setTimeout(strike, preview ? 4000 : 20000);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [ref, on, preview]);
}

/* ------------------------------------------------------------------ */
/*  Icône d'onglet                                                     */
/* ------------------------------------------------------------------ */

const FAVICON =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><ellipse cx="22" cy="36" rx="16" ry="19" fill="#f08a1c"/><ellipse cx="42" cy="36" rx="16" ry="19" fill="#f08a1c"/><ellipse cx="32" cy="36" rx="16" ry="21" fill="#ff9a2a"/><path d="M29 15 Q30 5 38 5 L40 9 Q35 10 35 15Z" fill="#4d7c0f"/><path d="M17 30 L27 30 L22 20Z M37 30 L47 30 L42 20Z M18 41 L24 38 L28 44 L32 38 L36 44 L40 38 L46 41 Q40 54 32 54 Q24 54 18 41Z" fill="#3a1500"/></svg>',
  );

function useFavicon(on: boolean) {
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
      l.setAttribute('href', FAVICON);
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
  }, [on, pathname]);
}

/* ------------------------------------------------------------------ */
/*  Assemblage                                                         */
/* ------------------------------------------------------------------ */

export default function HalloweenTheme({ options, preview, quiet = false }: Props) {
  const env = useEnv(preview);
  const mult = MULT[options.intensity] ?? 1;
  const fx = options.effects;
  const on = (k: string) => fx[k] === true && !(quiet && QUIET_OFF.has(k));
  const motion = !env.calm; // le visiteur accepte les animations
  const canvasOk = motion && !env.lite;
  const pointerOk = canvasOk && env.fine;

  const batsRef = useRef<HTMLDivElement>(null);
  const embersRef = useRef<HTMLCanvasElement>(null);
  const trailRef = useRef<HTMLCanvasElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);

  useBats(batsRef, on('bats') && canvasOk, mult, env.mobile, preview);
  useEmbers(embersRef, on('embers') && canvasOk, mult, env.mobile);
  useCursorTrail(trailRef, on('cursorTrail') && pointerOk);
  useGhost(ghostRef, on('ghost') && pointerOk);
  useLightning(flashRef, on('lightning') && motion, preview);
  useFavicon(on('favicon'));

  // marqueur sur <html> + pied de page pour le cimetière
  const [footer, setFooter] = useState<HTMLElement | null>(null);
  useEffect(() => {
    document.documentElement.setAttribute('data-season', 'halloween');
    return () => document.documentElement.removeAttribute('data-season');
  }, []);
  const grave = on('graveyard');
  useEffect(() => {
    if (!grave) { setFooter(null); return; }
    const f = document.querySelector<HTMLElement>('footer');
    if (!f) return;
    f.classList.add('hw-footer');
    setFooter(f);
    return () => {
      f.classList.remove('hw-footer');
      setFooter(null);
    };
  }, [grave]);

  return (
    <>
      <style>{CSS}</style>

      <div className={`hw-root${env.calm ? ' hw-calm' : ''}`} aria-hidden="true">
        {on('vignette') && (<><div className="hw-vig" /><div className="hw-strip" /></>)}
        {on('fog') && (<><div className="hw-fog b" /><div className="hw-fog" /></>)}
        {on('embers') && canvasOk && <canvas ref={embersRef} className="hw-canvas" />}
        {on('webs') && (<><Web side="l" /><Web side="r" /></>)}
        {on('spider') && !env.lite && <Spider />}
        {on('bats') && canvasOk && <div ref={batsRef} style={{ position: 'absolute', inset: 0 }} />}
        {on('cursorTrail') && pointerOk && <canvas ref={trailRef} className="hw-canvas" />}
        {on('ghost') && pointerOk && (<div ref={ghostRef} className="hw-ghost"><Ghost /></div>)}
        {on('lightning') && motion && <div ref={flashRef} className="hw-flash" />}
      </div>

      {footer && createPortal(<div className="hw-grave" aria-hidden="true"><Graveyard /></div>, footer)}

      {on('banner') && <Banner opt={options.banner} preview={preview} calm={env.calm} />}
    </>
  );
}
