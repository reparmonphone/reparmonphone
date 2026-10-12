'use client';

import { useEffect } from 'react';

// ============================================================================
// TRANSITION "LE PRODUIT S'ENVOLE" (clic sur un produit → fiche produit)
//
//  1. Au clic, un fond bleu ReparMonPhone s'étend depuis le doigt / la souris.
//  2. La photo du produit se détache de sa carte et s'envole au centre, entourée des
//     flèches du logo qui tournent et d'ondes de radar.
//  3. Dès que la fiche est prête, la photo vient se poser EXACTEMENT à la place de la photo
//     principale pendant que le fond bleu se referme dessus, puis un reflet de lumière la balaye.
//
// Aucune bibliothèque : tout est du CSS (classes .pt-* dans globals.css) + ce petit script.
// Rien ne se joue si le visiteur a demandé "moins d'animations", si le mode économie de données
// est actif, avec Ctrl/Cmd/Maj+clic (nouvel onglet) ou dans l'administration.
// Si la fiche met trop de temps à arriver, l'animation se retire d'elle-même (filet de sécurité).
// La fiche produit doit contenir un élément [data-pt-target] (la photo principale, voir ProductGallery.tsx).
// ============================================================================

const MIN_HOLD_MS = 1250; // durée minimale de l'envol avant l'atterrissage
const LAND_MS = 820; // durée de l'atterrissage
const GIVE_UP_MS = 8000; // abandon si la fiche n'arrive jamais

type Ctx = {
  root: HTMLDivElement;
  bg: HTMLDivElement;
  box: HTMLDivElement;
  pic: HTMLImageElement;
  ring: HTMLDivElement;
  dest: string;
  readyAt: number;
  startedAt: number;
  stage: 'hold' | 'land' | 'end';
  target?: HTMLElement;
  poll: number;
  kill: number;
};

let ctx: Ctx | null = null;

function ringSvg(): string {
  // 3 flèches circulaires, comme dans le logo
  const R = 86;
  const pt = (deg: number) => {
    const a = (deg * Math.PI) / 180;
    return [100 + R * Math.cos(a), 100 + R * Math.sin(a)];
  };
  let out = '<svg viewBox="0 0 200 200" aria-hidden="true">';
  for (let i = 0; i < 3; i++) {
    const a0 = i * 120 - 80;
    const a1 = a0 + 78;
    const [x0, y0] = pt(a0);
    const [x1, y1] = pt(a1);
    // pointe de flèche à l'extrémité, orientée selon la tangente
    const t = ((a1 + 90) * Math.PI) / 180;
    const [cx, cy] = [x1, y1];
    const tip = [cx + Math.cos(t) * 15, cy + Math.sin(t) * 15];
    const n = [Math.cos(t + Math.PI / 2) * 10, Math.sin(t + Math.PI / 2) * 10];
    out += `<path d="M${x0.toFixed(1)} ${y0.toFixed(1)}A${R} ${R} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}" fill="none" stroke="#A9DEF1" stroke-width="7" stroke-linecap="round"/>`;
    out += `<path d="M${(cx + n[0]).toFixed(1)} ${(cy + n[1]).toFixed(1)}L${tip[0].toFixed(1)} ${tip[1].toFixed(1)}L${(cx - n[0]).toFixed(1)} ${(cy - n[1]).toFixed(1)}Z" fill="#A9DEF1"/>`;
  }
  return out + '</svg>';
}

const div = (cls: string) => {
  const d = document.createElement('div');
  d.className = cls;
  return d;
};

function pickImage(a: HTMLAnchorElement): HTMLImageElement | null {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  for (const img of Array.from(a.querySelectorAll('img'))) {
    const r = img.getBoundingClientRect();
    if (r.width >= 60 && r.height >= 60 && r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw) return img;
  }
  return null;
}

function finish(success: boolean, target?: HTMLElement | null) {
  const c = ctx;
  if (!c || c.stage === 'end') return;
  c.stage = 'end';
  window.clearInterval(c.poll);
  window.clearTimeout(c.kill);
  const cleanup = () => {
    c.root.remove();
    // La photo vient d'atterrir : on évite qu'elle rejoue son animation d'entrée (elle clignoterait)
    document.querySelectorAll('.pg-enter').forEach((el) => el.classList.add('pg-done'));
    document.documentElement.removeAttribute('data-pt');
    if (ctx === c) ctx = null;
  };
  target = target ?? c.target;
  if (target) {
    target.style.visibility = '';
    if (success) {
      target.classList.add('pt-landed');
      window.setTimeout(() => target.classList.remove('pt-landed'), 1900);
    }
  }
  if (success) {
    cleanup();
  } else {
    c.root.classList.add('out');
    window.setTimeout(cleanup, 380);
  }
}

function enter(target: HTMLElement) {
  const c = ctx;
  if (!c) return;
  c.stage = 'land';
  c.target = target;
  target.style.visibility = 'hidden';
  window.scrollTo(0, 0);
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      if (!ctx || ctx !== c) return;
      const tr = target.getBoundingClientRect();
      const timg = target.querySelector('img');
      const pad = timg ? getComputedStyle(timg).padding : '8%';
      const radius = getComputedStyle(target).borderRadius || '12px';
      c.bg.style.setProperty('--cx', `${tr.left + tr.width / 2}px`);
      c.bg.style.setProperty('--cy', `${tr.top + tr.height / 2}px`);
      c.bg.classList.remove('on');
      c.ring.classList.remove('on');
      c.root.classList.add('landing');
      c.box.classList.remove('float');
      c.box.style.left = `${tr.left}px`;
      c.box.style.top = `${tr.top}px`;
      c.box.style.width = `${tr.width}px`;
      c.box.style.height = `${tr.height}px`;
      c.box.style.borderRadius = radius;
      c.pic.style.padding = pad;
      window.setTimeout(() => finish(true, target), LAND_MS);
    }),
  );
}

function tick() {
  const c = ctx;
  if (!c || c.stage !== 'hold') return;
  const now = Date.now();
  if (location.pathname !== c.dest) {
    if (now - c.startedAt > GIVE_UP_MS - 1000) finish(false);
    return;
  }
  if (now < c.readyAt) return;
  const target = document.querySelector<HTMLElement>('[data-pt-target]');
  if (!target) {
    if (now - c.readyAt > 3000) finish(false);
    return;
  }
  const timg = target.querySelector('img');
  if (timg && !timg.complete && now - c.readyAt < 2500) return;
  enter(target);
}

function start(img: HTMLImageElement, x: number, y: number, dest: string) {
  if (ctx) finish(false);
  const r = img.getBoundingClientRect();
  const cs = getComputedStyle(img);
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const root = div('pt-root');
  const bg = div('pt-bg');
  bg.style.setProperty('--cx', `${x}px`);
  bg.style.setProperty('--cy', `${y}px`);
  bg.style.setProperty('--r', `${Math.hypot(Math.max(x, vw - x), Math.max(y, vh - y)) + 40}px`);
  const dots = div('pt-dots');

  const S = Math.min(360, Math.min(vw * 0.64, vh * 0.52));
  const cx = vw / 2;
  const cy = vh / 2 - Math.min(20, vh * 0.03);

  const ring = div('pt-ring');
  ring.innerHTML = ringSvg();
  const ringSize = S * 1.62;
  ring.style.cssText = `left:${cx - ringSize / 2}px;top:${cy - ringSize / 2}px;width:${ringSize}px;height:${ringSize}px`;
  const ping1 = div('pt-ping');
  const ping2 = div('pt-ping p2');
  for (const p of [ping1, ping2]) p.style.cssText = `left:${cx - S / 2}px;top:${cy - S / 2}px;width:${S}px;height:${S}px`;

  const box = div('pt-box');
  box.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;border-radius:8px`;
  const pic = new Image();
  pic.alt = '';
  pic.src = img.currentSrc || img.src;
  pic.style.padding = cs.padding;
  box.appendChild(pic);

  root.append(bg, dots, ping1, ping2, ring, box);
  document.body.appendChild(root);
  document.documentElement.setAttribute('data-pt', '1');

  const now = Date.now();
  const c: Ctx = {
    root,
    bg,
    box,
    pic,
    ring,
    dest,
    startedAt: now,
    readyAt: now + MIN_HOLD_MS,
    stage: 'hold',
    poll: window.setInterval(tick, 80),
    kill: window.setTimeout(() => finish(false), GIVE_UP_MS),
  };
  ctx = c;

  void root.offsetWidth; // force le premier affichage avant de lancer l'envol
  requestAnimationFrame(() => {
    if (ctx !== c) return;
    root.classList.add('on');
    bg.classList.add('on');
    ring.classList.add('on');
    box.style.left = `${cx - S / 2}px`;
    box.style.top = `${cy - S / 2}px`;
    box.style.width = `${S}px`;
    box.style.height = `${S}px`;
    box.style.borderRadius = '28px';
    pic.style.padding = '9%';
    window.setTimeout(() => {
      if (ctx === c && c.stage === 'hold') box.classList.add('float');
    }, 800);
  });
}

export default function ProductTransition() {
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
      if (url.origin !== location.origin || !url.pathname.startsWith('/produit/')) return;
      if (location.pathname.startsWith('/admin') || url.pathname === location.pathname) return;
      const img = pickImage(a);
      if (!img) return;
      start(img, e.clientX, e.clientY, url.pathname);
    };
    // Retour arrière du navigateur pendant l'animation : on arrête tout proprement
    const onPop = () => finish(false);

    document.addEventListener('click', onClick, true);
    window.addEventListener('popstate', onPop);
    return () => {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('popstate', onPop);
    };
  }, []);

  return null;
}
