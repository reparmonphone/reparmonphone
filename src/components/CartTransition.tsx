'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useCart } from '@/store/cart';

// Transition « ouverture du panier » : quand le visiteur clique sur « Panier » (en-tête) alors que son
// panier contient des articles, un voile s'ouvre depuis le bouton, les VRAIES PHOTOS de ses produits
// s'affichent en grand (avec leur quantité), puis chacune s'envole en arc de cercle dans le sac, le
// compteur s'incrémente, le total se compte, puis le voile se retire et la page Panier se dévoile avec
// ses lignes qui arrivent en cascade. Une fois les produits dans le sac, un camion de livraison traverse
// l'écran de gauche à droite (route, roues qui tournent, phare, fumée). ~5 s au total selon le nombre
// de produits ; un clic / Échap l'abrège.
// Aucune animation pour les visiteurs qui ont demandé « moins d'animations » ou activé l'économie de
// données : le lien fonctionne alors normalement. Même principe que ProductTransition (clic capté en
// phase de capture, navigation par le routeur Next pendant que l'écran est couvert).

const TRUCK_DUR = 2.3; // traversée du camion (s)
const TRUCK_GAP = 0.15; // délai entre l'atterrissage du dernier produit et l'entrée du camion (s)
const FAILSAFE_EXTRA_MS = 2500; // si la navigation traîne, on découvre la page quand même
const OUT_MS = 480;
const CARD_W = 98; // largeur d'une vignette produit
const CARD_GAP = 12;
const MAX_CARDS = 4; // au-delà : 3 produits + une vignette « +N »
const SHOW_AT = 0.55; // apparition des vignettes (s)
const SHOW_STEP = 0.13;
const FLY0 = 1.55; // début des envols (s)
const FLY_STEP = 0.24;
const FLY_DUR = 0.78;
const ROT = [-9, 7, -6, 10];
const SPARKS = [
  { x: -118, y: -70, s: 1, d: 0 }, { x: 122, y: -52, s: 0.8, d: 0.25 }, { x: -96, y: 62, s: 0.7, d: 0.5 },
  { x: 108, y: 74, s: 1, d: 0.15 }, { x: 0, y: -128, s: 0.8, d: 0.4 }, { x: -140, y: 6, s: 0.6, d: 0.6 }, { x: 146, y: 14, s: 0.6, d: 0.1 },
];

type Snap = { id: string; img: string | null; n: number; more?: number };
type Ctx = { x: number; y: number; snaps: Snap[]; count: number; total: number };

const ICONS = [
  { k: 'phone', l: 6, s: 34, d: 11, dl: 0, r: 25 }, { k: 'gear', l: 15, s: 40, d: 13, dl: -4, r: 180 }, { k: 'bolt', l: 26, s: 26, d: 9, dl: -2, r: -20 },
  { k: 'screw', l: 36, s: 22, d: 12, dl: -7, r: 120 }, { k: 'battery', l: 47, s: 36, d: 10, dl: -5, r: -15 }, { k: 'phone', l: 58, s: 28, d: 12.5, dl: -1, r: -30 },
  { k: 'gear', l: 68, s: 30, d: 9.5, dl: -6, r: -160 }, { k: 'bolt', l: 77, s: 34, d: 11.5, dl: -3, r: 18 }, { k: 'screw', l: 86, s: 26, d: 13, dl: -8, r: -100 },
  { k: 'battery', l: 93, s: 30, d: 10.5, dl: -2.5, r: 20 },
] as const;

// moment où le camion entre (s) et durée minimale d'affichage du voile (ms), selon le nombre de vignettes
const bagBounceFor = (n: number) => FLY0 + (n - 1) * FLY_STEP + FLY_DUR * 0.78;
const truckStartFor = (n: number) => bagBounceFor(n) + TRUCK_GAP;
const showMsFor = (n: number) => Math.round((truckStartFor(n) + TRUCK_DUR + 0.3) * 1000);

const eur = (n: number) => n.toFixed(2).replace('.', ',') + ' €';

export default function CartTransition() {
  const router = useRouter();
  const pathname = usePathname();
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [phase, setPhase] = useState<'in' | 'out'>('in');
  const [shown, setShown] = useState(0); // articles « tombés » dans le sac (badge)
  const [total, setTotal] = useState(0); // total qui défile
  const startedAt = useRef(0);
  const timers = useRef<number[]>([]);
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  function clearTimers() {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }

  function finish() {
    clearTimers();
    document.documentElement.classList.remove('cart-tx');
    document.body.style.overflow = '';
    setCtx(null);
  }

  function leave() {
    // le voile se retire ; la page Panier (déjà chargée dessous) lance sa cascade d'entrée
    setPhase((p) => {
      if (p === 'out') return p;
      document.documentElement.classList.remove('cart-tx');
      timers.current.push(window.setTimeout(finish, OUT_MS + 60));
      return 'out';
    });
  }

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (conn?.saveData) return;

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      let url: URL;
      try {
        url = new URL(a.href, location.href);
      } catch {
        return;
      }
      // uniquement le bouton « Panier » de l'en-tête, depuis une autre page, panier non vide
      if (url.origin !== location.origin || url.pathname !== '/panier' || !a.closest('header')) return;
      if (location.pathname === '/panier' || location.pathname.startsWith('/admin')) return;
      const items = useCart.getState().items;
      if (items.length === 0) return;

      e.preventDefault();
      const r = a.getBoundingClientRect();
      let snaps: Snap[];
      if (items.length > MAX_CARDS) {
        const rest = items.slice(MAX_CARDS - 1);
        snaps = [
          ...items.slice(0, MAX_CARDS - 1).map((i) => ({ id: i.productId, img: i.imageUrl, n: i.quantity })),
          { id: '__more', img: null, n: rest.reduce((s, i) => s + i.quantity, 0), more: rest.length },
        ];
      } else {
        snaps = items.map((i) => ({ id: i.productId, img: i.imageUrl, n: i.quantity }));
      }
      // précharge les photos : elles sont déjà là quand les vignettes apparaissent
      snaps.forEach((s) => {
        if (s.img) {
          const im = new window.Image();
          im.src = s.img;
        }
      });
      const count = items.reduce((s, i) => s + i.quantity, 0);
      const totalPrice = items.reduce((s, i) => s + i.price * i.quantity, 0);
      clearTimers();
      startedAt.current = performance.now();
      document.documentElement.classList.add('cart-tx');
      document.body.style.overflow = 'hidden';
      setShown(0);
      setTotal(0);
      setPhase('in');
      setCtx({ x: r.left + r.width / 2, y: r.top + r.height / 2, snaps, count, total: totalPrice });
      router.push('/panier');
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // déroulé : badge qui s'incrémente à chaque atterrissage, total qui défile, filet de sécurité
  useEffect(() => {
    if (!ctx) return;
    // le badge du sac s'incrémente de la quantité de chaque produit au moment où il y atterrit
    let acc = 0;
    ctx.snaps.forEach((s, i) => {
      acc += s.n;
      const sum = acc;
      timers.current.push(window.setTimeout(() => setShown(sum), (FLY0 + i * FLY_STEP + FLY_DUR * 0.8) * 1000));
    });
    const t0 = performance.now() + (FLY0 + 0.1) * 1000;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - t0) / 1500));
      setTotal(ctx.total * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    timers.current.push(window.setTimeout(leave, showMsFor(ctx.snaps.length) + FAILSAFE_EXTRA_MS));
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && leave();
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx]);

  // la page /panier est affichée : on attend la durée minimale puis on retire le voile
  useEffect(() => {
    if (!ctx || pathname !== '/panier') return;
    const wait = Math.max(0, showMsFor(ctx.snaps.length) - (performance.now() - startedAt.current));
    const t = window.setTimeout(leave, wait);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, pathname]);

  useEffect(() => () => finish(), []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ctx) return null;
  const n = ctx.snaps.length;
  const bagBounceAt = bagBounceFor(n);
  const truckAt = truckStartFor(n);

  return (
    <div
      className={`ct-root${phase === 'out' ? ' ct-out' : ''}`}
      role="status"
      aria-live="polite"
      aria-label="Ouverture de ton panier"
      onClick={leave}
      style={{ ['--ox' as string]: `${ctx.x}px`, ['--oy' as string]: `${ctx.y}px`, ['--bar' as string]: `${showMsFor(n)}ms` }}
    >
      <style>{CSS}</style>
      <div className="ct-bg" aria-hidden="true">
        <i className="ct-aur" style={{ left: '-8%', top: '-12%', width: 520, height: 520, background: '#22d3ee', animationDelay: '0s' }} />
        <i className="ct-aur" style={{ right: '-10%', top: '6%', width: 580, height: 580, background: '#7c3aed', animationDelay: '-3s' }} />
        <i className="ct-aur" style={{ left: '28%', bottom: '-22%', width: 520, height: 520, background: '#ec4899', animationDelay: '-5s' }} />
        <i className="ct-aur" style={{ left: '38%', top: '22%', width: 380, height: 380, background: '#0E7FDB', animationDelay: '-1.5s', opacity: 0.8 }} />
        <div className="ct-grid" />
        {ICONS.map((ic, i) => (
          <svg key={i} className="ct-ico" viewBox="0 0 24 24" style={{ left: `${ic.l}%`, width: ic.s, height: ic.s, ['--d' as string]: `${ic.d}s`, ['--dl' as string]: `${ic.dl}s`, ['--r' as string]: `${ic.r}deg` }}>
            {ic.k === 'phone' && <rect x="7" y="2" width="10" height="20" rx="2.5" fill="currentColor" />}
            {ic.k === 'bolt' && <path d="M13 2 4 14h6l-1 8 9-12h-6z" fill="currentColor" />}
            {ic.k === 'gear' && <path fill="currentColor" transform="translate(-1 0)" d="M19.4 13a7.5 7.5 0 0 0 0-2l2-1.6-2-3.4-2.4.9a7.6 7.6 0 0 0-1.7-1L15 3.3h-4l-.4 2.6a7.6 7.6 0 0 0-1.7 1l-2.4-.9-2 3.4 2 1.6a7.5 7.5 0 0 0 0 2l-2 1.6 2 3.4 2.4-.9a7.6 7.6 0 0 0 1.7 1l.4 2.6h4l.4-2.6a7.6 7.6 0 0 0 1.7-1l2.4.9 2-3.4zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z" />}
            {ic.k === 'battery' && <><rect x="3" y="8" width="16" height="9" rx="2" fill="currentColor" /><rect x="20" y="10.5" width="2" height="4" rx="1" fill="currentColor" /></>}
            {ic.k === 'screw' && <><circle cx="12" cy="12" r="9" fill="currentColor" /><path d="M7 12h10M12 7v10" stroke="#0a0f2c" strokeWidth="2" strokeLinecap="round" /></>}
          </svg>
        ))}
      </div>

      <div className="ct-stage">
        <div className="ct-scene" aria-hidden="true">
          {/* étincelles après le dernier atterrissage */}
          {SPARKS.map((s, i) => (
            <svg key={i} className="ct-spark" viewBox="0 0 24 24" style={{ ['--sx' as string]: `${s.x}px`, ['--sy' as string]: `${s.y}px`, ['--ss' as string]: s.s, animationDelay: `${bagBounceAt + s.d}s` }}>
              <path d="M12 0c.8 6.4 5.6 11.2 12 12-6.4.8-11.2 5.6-12 12-.8-6.4-5.6-11.2-12-12C6.4 11.2 11.2 6.4 12 0z" fill="#fde68a" />
            </svg>
          ))}

          {/* vignettes produit : elles apparaissent en grand, puis chacune s'envole dans le sac */}
          {ctx.snaps.map((s, i) => {
            const cx = (i - (n - 1) / 2) * (CARD_W + CARD_GAP);
            return (
              <div
                key={s.id}
                className="ct-card"
                style={{
                  ['--cx' as string]: `${cx}px`,
                  ['--rot' as string]: `${ROT[i % ROT.length]}deg`,
                  animationDelay: `${FLY0 + i * FLY_STEP}s`,
                }}
              >
                <div className="ct-card-in" style={{ animationDelay: `${SHOW_AT + i * SHOW_STEP}s` }}>
                  <div className="ct-photo">
                    {s.more ? (
                      <span className="ct-more">+{s.more}</span>
                    ) : s.img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.img} alt="" draggable={false} />
                    ) : (
                      <svg viewBox="0 0 24 24" width="34" height="34"><path fill="#0E7FDB" d="M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm5 17.5a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4z" /></svg>
                    )}
                  </div>
                  {s.n > 1 && !s.more && <span className="ct-qty">×{s.n}</span>}
                </div>
              </div>
            );
          })}

          {/* le sac */}
          <div className="ct-bag" style={{ ['--bd' as string]: `${bagBounceAt}s` }}>
            <svg viewBox="0 0 200 220" width="200" height="220">
              <defs>
                <linearGradient id="ctBagBody" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#ffffff" />
                  <stop offset="1" stopColor="#cfe5fb" />
                </linearGradient>
                <linearGradient id="ctShine" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0" stopColor="#fff" stopOpacity="0" />
                  <stop offset="0.5" stopColor="#fff" stopOpacity="0.85" />
                  <stop offset="1" stopColor="#fff" stopOpacity="0" />
                </linearGradient>
                <clipPath id="ctBagClip"><path d="M30 78 L170 78 L182 200 Q183 213 170 213 L30 213 Q17 213 18 200 Z" /></clipPath>
              </defs>
              {/* anses (derrière) */}
              <path className="ct-draw" d="M68 80 C 68 28, 132 28, 132 80" fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round" />
              {/* intérieur sombre de l'ouverture */}
              <ellipse cx="100" cy="80" rx="70" ry="9" fill="#0a4f8c" opacity="0.55" />
              {/* corps du sac (devant : cache les produits qui y sont tombés) */}
              <path className="ct-body" d="M30 78 L170 78 L182 200 Q183 213 170 213 L30 213 Q17 213 18 200 Z" fill="url(#ctBagBody)" />
              <g clipPath="url(#ctBagClip)">
                <rect className="ct-glint" x="-80" y="70" width="70" height="150" fill="url(#ctShine)" transform="skewX(-18)" />
              </g>
              <path className="ct-draw" d="M30 78 L170 78 L182 200 Q183 213 170 213 L30 213 Q17 213 18 200 Z" fill="none" stroke="#fff" strokeWidth="3" strokeLinejoin="round" />
              {/* pictogramme panier sur le sac */}
              <g transform="translate(70 118)" fill="none" stroke="#0E7FDB" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M0 0h8l8 34h34l6-24H12" />
                <circle cx="22" cy="46" r="3.5" fill="#0E7FDB" stroke="none" />
                <circle cx="46" cy="46" r="3.5" fill="#0E7FDB" stroke="none" />
              </g>
            </svg>
            <span key={shown} className={`ct-badge${shown > 0 ? ' on' : ''}`}>{shown}</span>
          </div>
        </div>

        <p className="ct-title">Ton panier est prêt</p>
        <p className="ct-sub">
          {ctx.count} article{ctx.count > 1 ? 's' : ''} <b>·</b> <strong>{eur(total)}</strong>
        </p>
        <div className="ct-chips">
          <span style={{ animationDelay: '1.35s' }}>
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M12 1 3 5v6c0 5.5 3.8 10.7 9 12 5.2-1.3 9-6.5 9-12V5l-9-4zm-1 15-4-4 1.4-1.4L11 13.2l5.6-5.6L18 9l-7 7z" /></svg>
            Paiement 100 % sécurisé
          </span>
          <span style={{ animationDelay: '1.65s' }}>
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M3 6h11v9H3zM14 9h4l3 3v3h-7zM7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" /></svg>
            Expédition rapide Chronopost
          </span>
          <span style={{ animationDelay: '1.95s' }}>
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M12 5V2L7 6.5 12 11V8a5 5 0 1 1-5 5H5a7 7 0 1 0 7-8z" /></svg>
            Retour sous 14 jours
          </span>
        </div>
      </div>


      {/* route + camion de livraison qui traverse l'écran une fois les produits dans le sac */}
      <div className="ct-road" aria-hidden="true" style={{ animationDelay: `${Math.max(0, truckAt - 0.3)}s` }} />
      <div className="ct-truck" aria-hidden="true" style={{ animationDelay: `${truckAt}s` }}>
        <svg viewBox="0 0 300 132" width="300" height="132" style={{ overflow: 'visible' }}>
          <defs>
            <linearGradient id="ctTrBox" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="1" stopColor="#dbe7f7" />
            </linearGradient>
            <linearGradient id="ctTrCab" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#2b9bf5" />
              <stop offset="1" stopColor="#0a5ea8" />
            </linearGradient>
            <linearGradient id="ctTrGlass" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#e0f2fe" />
              <stop offset="1" stopColor="#7cc4f5" />
            </linearGradient>
            <linearGradient id="ctTrBeam" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#fff7c2" stopOpacity="0.75" />
              <stop offset="1" stopColor="#fff7c2" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* faisceau du phare */}
          <polygon points="288,84 430,52 430,112" fill="url(#ctTrBeam)" />
          {/* ombre portée */}
          <ellipse cx="150" cy="128" rx="140" ry="5" fill="#000" opacity="0.35" />
          {/* lignes de vitesse */}
          {[34, 56, 78, 100].map((y, i) => (
            <line key={y} className="ct-sl" x1={-20 - i * 6} y1={y} x2={-92 - i * 10} y2={y} stroke="#fff" strokeWidth="2.4" strokeLinecap="round" style={{ animationDelay: `${i * 0.11}s` }} />
          ))}
          {/* fumée d'échappement */}
          {[0, 0.3, 0.6].map((d) => (
            <circle key={d} className="ct-puff" cx="2" cy="104" r="6" fill="#cbd5e1" style={{ animationDelay: `${d}s` }} />
          ))}

          <g className="ct-tr-body">
            {/* caisse */}
            <rect x="6" y="12" width="178" height="88" rx="8" fill="url(#ctTrBox)" />
            <rect x="6" y="78" width="178" height="11" fill="#0E7FDB" />
            <rect x="6" y="89" width="178" height="3" fill="#0a5ea8" />
            <rect x="6" y="12" width="178" height="5" rx="3" fill="#fff" opacity="0.8" />
            {/* marque */}
            <g transform="translate(22 30)">
              <rect width="15" height="26" rx="3.5" fill="#0E7FDB" />
              <rect x="5" y="2.5" width="5" height="1.6" rx=".8" fill="#fff" />
              <circle cx="7.5" cy="21.5" r="1.5" fill="#fff" />
            </g>
            <text x="44" y="44" fontSize="17" fontWeight="800" fill="#0E7FDB" fontFamily="Arial, Helvetica, sans-serif" letterSpacing="-0.2">ReparMonPhone</text>
            <text x="45" y="59" fontSize="8.6" fontWeight="700" fill="#475569" fontFamily="Arial, Helvetica, sans-serif" letterSpacing="0.7">LIVRAISON EXPRESS 24H</text>
            {/* feu arrière */}
            <rect x="3" y="62" width="5" height="14" rx="2" fill="#ef4444" />
            {/* cabine */}
            <path d="M184 100 V32 H236 Q247 32 254 42 L281 72 Q288 80 288 89 V100 Z" fill="url(#ctTrCab)" />
            <path d="M196 42 H234 Q240 42 244 48 L261 70 H196 Z" fill="url(#ctTrGlass)" />
            <path d="M205 42 H216 L200 70 H196 V50 Z" fill="#fff" opacity="0.4" />
            <rect x="190" y="76" width="14" height="3" rx="1.5" fill="#082f55" opacity="0.55" />
            <rect x="238" y="73" width="3" height="9" rx="1.5" fill="#082f55" opacity="0.5" />
            <rect x="248" y="38" width="9" height="5" rx="2" fill="#0a3f73" transform="rotate(28 252 40)" />
            {/* pare-chocs + phare */}
            <rect x="280" y="90" width="15" height="10" rx="3" fill="#1f2937" />
            <ellipse cx="286" cy="82" rx="5.5" ry="4.2" fill="#fef9c3" />
            <ellipse cx="286" cy="82" rx="10" ry="8" fill="#fef08a" opacity="0.35" />
            {/* châssis */}
            <rect x="6" y="100" width="284" height="8" rx="2" fill="#1f2937" />
          </g>

          {/* passages de roue + roues */}
          {[62, 238].map((cx) => (
            <g key={cx}>
              <circle cx={cx} cy="109" r="21" fill="#0b1220" />
              <g className="ct-wheel" transform={`translate(${cx} 109)`}>
                <g className="ct-wheel-spin">
                  <circle r="17" fill="#111827" />
                  <circle r="17" fill="none" stroke="#374151" strokeWidth="2" />
                  <circle r="9.5" fill="#cbd5e1" />
                  <path d="M0 -9.5V9.5M-9.5 0H9.5M-6.7 -6.7L6.7 6.7M-6.7 6.7L6.7 -6.7" stroke="#64748b" strokeWidth="1.6" />
                  <circle r="3" fill="#475569" />
                </g>
              </g>
              <path d={`M${cx - 22} 118 h44 v6 h-44 z`} fill="none" />
            </g>
          ))}
        </svg>
      </div>

      <div className="ct-bar" aria-hidden="true"><i /></div>
    </div>
  );
}

const CSS = `
.ct-root{position:fixed;inset:0;z-index:9999;overflow:hidden;color:#fff;font-family:inherit;cursor:pointer;
  clip-path:circle(0 at var(--ox) var(--oy));animation:ct-open .62s cubic-bezier(.7,0,.2,1) forwards}
.ct-root.ct-out{animation:none;clip-path:circle(150vmax at var(--ox) var(--oy));opacity:0;transform:scale(1.03);filter:blur(6px);
  transition:opacity ${OUT_MS}ms ease,transform ${OUT_MS}ms ease,filter ${OUT_MS}ms ease;pointer-events:none}
@keyframes ct-open{to{clip-path:circle(150vmax at var(--ox) var(--oy))}}
.ct-bg{position:absolute;inset:0;overflow:hidden;background:radial-gradient(110% 80% at 50% 30%,#18235a 0%,#0c1233 55%,#070a1f 100%)}
.ct-aur{position:absolute;border-radius:50%;filter:blur(70px);opacity:.62;animation:ct-drift 8s ease-in-out infinite alternate;will-change:transform}
@keyframes ct-drift{from{transform:translate(0,0) scale(1)}to{transform:translate(46px,-34px) scale(1.18)}}
.ct-grid{position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,.16) 1px,transparent 1.4px);background-size:30px 30px;
  -webkit-mask-image:radial-gradient(70% 60% at 50% 45%,#000 20%,transparent 100%);mask-image:radial-gradient(70% 60% at 50% 45%,#000 20%,transparent 100%)}
.ct-ico{position:absolute;bottom:-70px;color:#fff;opacity:0;animation:ct-ico var(--d) linear infinite;animation-delay:var(--dl)}
@keyframes ct-ico{0%{opacity:0;transform:translateY(0) rotate(0)}12%{opacity:.17}88%{opacity:.17}100%{opacity:0;transform:translateY(-118vh) rotate(var(--r))}}
.ct-stage{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;padding:0 24px;text-align:center}
.ct-scene{position:relative;width:460px;height:350px;margin-bottom:6px}
.ct-bag{position:absolute;left:130px;top:130px;width:200px;height:220px;transform-origin:50% 100%;opacity:0;
  animation:ct-bag-in .5s cubic-bezier(.34,1.56,.64,1) .3s forwards,ct-bag-bounce .55s ease var(--bd) both;filter:drop-shadow(0 20px 34px rgba(0,0,0,.5)) drop-shadow(0 0 40px rgba(125,211,252,.25))}
@keyframes ct-bag-in{from{opacity:0;transform:translateY(40px) scale(.7)}to{opacity:1;transform:none}}
@keyframes ct-bag-bounce{0%{transform:none}30%{transform:scale(1.08,.9)}60%{transform:scale(.97,1.04)}100%{transform:none}}
.ct-bag svg{display:block;overflow:visible}
.ct-draw{stroke-dasharray:760;stroke-dashoffset:760;animation:ct-draw .7s ease-out .35s forwards}
@keyframes ct-draw{to{stroke-dashoffset:0}}
.ct-body{opacity:0;animation:ct-fade .35s ease .7s forwards}
@keyframes ct-fade{to{opacity:1}}
.ct-glint{animation:ct-glint 1.1s ease 1.05s both}
@keyframes ct-glint{from{transform:translateX(0) skewX(-18deg)}to{transform:translateX(330px) skewX(-18deg)}}
.ct-card{position:absolute;left:50%;top:0;width:${CARD_W}px;margin-left:-${CARD_W / 2}px;transform:translate(var(--cx),0);z-index:1;
  animation:ct-fly ${FLY_DUR}s cubic-bezier(.55,0,.35,1) forwards}
.ct-card-in{position:relative;opacity:0;animation:ct-card-in .55s cubic-bezier(.34,1.56,.64,1) forwards}
.ct-photo{width:${CARD_W}px;height:${CARD_W + 8}px;border-radius:18px;background:#fff;border:3px solid rgba(255,255,255,.95);
  box-shadow:0 16px 30px rgba(4,12,48,.5),0 0 0 4px rgba(125,211,252,.25);display:flex;align-items:center;justify-content:center;overflow:hidden}
.ct-photo img{width:100%;height:100%;object-fit:contain;padding:7px;background:#fff}
.ct-more{font-size:26px;font-weight:800;color:#0E7FDB}
.ct-qty{position:absolute;right:-8px;bottom:-8px;min-width:30px;height:30px;padding:0 8px;border-radius:999px;background:#0E7FDB;color:#fff;font-weight:800;font-size:14px;
  display:flex;align-items:center;justify-content:center;border:3px solid #fff;box-shadow:0 5px 12px rgba(0,0,0,.3)}
@keyframes ct-card-in{from{opacity:0;transform:translateY(34px) scale(.55) rotate(var(--rot))}to{opacity:1;transform:none}}
@keyframes ct-fly{
  0%{opacity:1;transform:translate(var(--cx),0) rotate(0deg) scale(1)}
  38%{opacity:1;transform:translate(calc(var(--cx) * .55),-26px) rotate(var(--rot)) scale(1.1)}
  78%{opacity:1;transform:translate(calc(var(--cx) * .06),136px) rotate(calc(var(--rot) * -.4)) scale(.46)}
  100%{opacity:0;transform:translate(0,190px) rotate(0deg) scale(.28)}}
.ct-bag{z-index:2}
.ct-badge{position:absolute;right:-6px;top:58px;min-width:40px;height:40px;padding:0 8px;border-radius:999px;background:#ef4444;color:#fff;font-weight:800;font-size:18px;
  display:flex;align-items:center;justify-content:center;border:3px solid #fff;box-shadow:0 6px 14px rgba(0,0,0,.25);opacity:0;transform:scale(.3)}
.ct-badge.on{opacity:1;animation:ct-pop .42s cubic-bezier(.34,1.8,.64,1) both}
@keyframes ct-pop{0%{transform:scale(.3)}60%{transform:scale(1.3)}100%{transform:scale(1)}}
.ct-spark{position:absolute;left:50%;top:68%;width:22px;height:22px;margin:-11px 0 0 -11px;opacity:0;animation:ct-spark 1.1s ease-out both;z-index:3}
@keyframes ct-spark{0%{opacity:0;transform:translate(0,0) scale(0) rotate(0)}30%{opacity:1}100%{opacity:0;transform:translate(var(--sx),var(--sy)) scale(var(--ss)) rotate(160deg)}}
.ct-title{margin:4px 0 0;font-size:26px;font-weight:800;letter-spacing:-.01em;opacity:0;transform:translateY(14px);animation:ct-up .55s cubic-bezier(.2,.8,.2,1) .55s forwards}
.ct-sub{margin:6px 0 0;font-size:16px;color:rgba(255,255,255,.88);opacity:0;transform:translateY(14px);animation:ct-up .55s cubic-bezier(.2,.8,.2,1) .68s forwards}
.ct-sub b{opacity:.6;margin:0 4px}
.ct-sub strong{font-size:20px;font-weight:800;color:#fff;font-variant-numeric:tabular-nums}
.ct-chips{margin:16px 0 0;display:flex;flex-wrap:wrap;justify-content:center;gap:8px;max-width:560px}
.ct-chips span{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:#fff;padding:6px 12px;border-radius:999px;
  background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.28);opacity:0;transform:translateY(10px) scale(.96);animation:ct-up .5s cubic-bezier(.2,.8,.2,1) forwards}
.ct-chips svg{color:#7dd3fc}
@keyframes ct-up{to{opacity:1;transform:none}}
.ct-bar{position:absolute;left:0;right:0;bottom:0;height:4px;background:rgba(255,255,255,.12)}
.ct-bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#22d3ee,#8b5cf6,#ec4899);box-shadow:0 0 16px rgba(139,92,246,.9);animation:ct-bar var(--bar) cubic-bezier(.3,.6,.3,1) .1s forwards}
@keyframes ct-bar{to{width:100%}}
.ct-road{position:absolute;left:0;right:0;bottom:14px;height:46px;opacity:0;z-index:3;
  background:linear-gradient(180deg,rgba(255,255,255,.10),rgba(8,12,40,.55) 55%,rgba(8,12,40,.7));
  border-top:2px solid rgba(125,211,252,.55);box-shadow:0 -8px 30px rgba(34,211,238,.18);animation:ct-road-in .5s ease forwards}
.ct-road::after{content:"";position:absolute;left:0;right:0;top:56%;height:3px;
  background:repeating-linear-gradient(90deg,rgba(255,255,255,.75) 0 38px,transparent 38px 92px);animation:ct-dash .42s linear infinite}
@keyframes ct-road-in{to{opacity:1}}
@keyframes ct-dash{to{background-position:-92px 0}}
.ct-truck{position:absolute;left:0;bottom:30px;width:300px;height:132px;z-index:4;transform:translateX(-560px);will-change:transform;
  animation:ct-truck ${TRUCK_DUR}s cubic-bezier(.32,.04,.55,1) forwards;filter:drop-shadow(0 10px 14px rgba(0,0,0,.35))}
@keyframes ct-truck{from{transform:translateX(-560px)}to{transform:translateX(calc(100vw + 160px))}}
.ct-tr-body{animation:ct-bob .2s ease-in-out infinite alternate}
@keyframes ct-bob{to{transform:translateY(-1.8px)}}
.ct-wheel-spin{animation:ct-spin .4s linear infinite}
@keyframes ct-spin{to{transform:rotate(360deg)}}
.ct-sl{opacity:0;animation:ct-sl .5s linear infinite}
@keyframes ct-sl{0%{opacity:0;transform:translateX(14px)}40%{opacity:.75}100%{opacity:0;transform:translateX(-34px)}}
.ct-puff{transform-box:fill-box;transform-origin:center;opacity:0;animation:ct-puff .9s ease-out infinite}
@keyframes ct-puff{0%{opacity:.55;transform:translate(0,0) scale(.4)}100%{opacity:0;transform:translate(-52px,-16px) scale(1.7)}}
@media (max-width:480px){.ct-truck{transform-origin:0 100%;scale:.72}.ct-road{height:44px}}
@media (max-width:480px){.ct-scene{transform:scale(.72);margin:-48px 0 -42px}.ct-title{font-size:22px}}
@media (max-height:660px){.ct-scene{transform:scale(.72);margin:-50px 0 -46px}}
`;
