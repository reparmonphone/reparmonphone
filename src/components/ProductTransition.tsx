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

const MIN_HOLD_MS = 600; // durée minimale de l'envol avant l'atterrissage
const LAND_MS = 550; // durée de l'atterrissage
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

// Les 3 flèches du logo ReparMonPhone (même dessin que le logo), centrées sur le centre de la boucle.
// Elles tournent dans le sens des flèches du logo (sens inverse des aiguilles d'une montre).
const LOGO_ARROWS = [
  'M197 292C195 292 191 292 182 291C175 291 175 291 178 287C180 282 180 282 177 280C175 279 174 278 174 278C174 278 174 277 173 277C171 276 166 269 161 262C160 261 157 255 157 254C156 252 155 248 155 248C154 248 154 247 154 246C154 246 153 244 153 243C153 242 152 241 152 240C152 239 151 237 151 236C151 234 150 233 150 232C150 232 150 230 149 228C149 227 149 225 149 224C148 224 147 216 147 212C147 210 147 208 147 208C146 206 146 188 146 188C146 188 146 185 146 183C147 171 148 159 150 150C150 149 151 147 151 146C152 139 153 135 154 133C154 132 155 130 155 128C156 125 158 120 159 118C159 117 160 116 160 115C160 114 161 113 161 112C161 112 162 109 163 107C164 105 166 101 166 100C167 99 168 97 168 97C168 96 169 95 169 94C170 92 171 90 172 89C172 88 173 86 173 86C174 86 175 83 176 81C177 80 178 79 178 79C179 78 179 78 180 77C181 75 182 73 183 72C183 72 184 71 185 70C186 68 188 66 190 65C190 64 192 63 193 62C194 61 195 60 196 59C197 58 198 57 199 57C204 52 213 48 220 47C225 46 228 47 235 48C236 48 239 50 240 50C240 50 242 51 243 52C246 54 248 55 251 59C255 62 258 67 258 68C258 68 259 69 260 70C260 71 260 71 260 72C260 72 261 72 261 73C262 75 262 76 261 76C261 76 260 74 258 73C255 69 255 70 252 68C251 67 250 67 249 66C248 65 239 62 234 62C229 62 221 64 218 66C218 66 217 67 217 67C216 67 208 72 208 73C207 73 206 74 206 75C203 77 198 81 198 83C197 84 195 86 194 87C194 87 193 89 192 89C192 90 191 91 191 92C190 93 188 96 187 97C186 100 185 101 184 102C184 102 181 107 180 110C179 111 179 113 178 113C178 114 177 116 176 119C176 119 175 121 175 122C174 123 174 124 174 124C173 125 173 126 172 127C172 128 171 130 171 132C170 134 169 137 169 138C167 143 166 148 166 150C166 151 165 152 165 152C165 153 165 154 164 156C164 157 164 159 164 160C163 162 162 172 161 174C161 175 161 176 161 176C160 181 159 209 161 216C161 218 161 219 162 224C162 226 162 228 162 230C163 232 163 234 164 236C164 238 165 240 165 241C165 242 166 243 166 244C166 244 166 246 167 246C167 247 167 249 168 250C168 251 168 252 169 253C169 254 169 255 169 255C170 255 173 263 174 264C174 264 175 266 176 267C177 268 178 270 178 271C179 271 180 272 180 273C182 275 183 276 184 274C184 274 187 271 187 270C188 270 189 271 189 271C189 271 190 272 190 272C191 273 192 273 192 274C192 274 193 275 194 276C194 277 195 278 196 279C197 281 200 283 200 284C201 284 202 285 202 286C202 286 203 287 203 288C205 291 206 292 205 292C204 293 200 293 197 292Z',
  'M186 334C182 333 179 333 176 332C174 332 172 332 171 332C168 331 161 329 160 329C160 329 159 328 158 328C156 328 152 326 152 326C152 325 150 324 148 324C146 322 144 321 144 321C144 321 143 320 143 320C142 320 141 319 137 315C134 312 133 311 131 307C131 305 130 304 130 304C127 301 127 284 130 277C130 276 131 275 131 274C131 273 132 272 132 272C132 272 133 270 133 269C134 268 135 267 135 266C135 266 136 265 136 265C136 265 138 262 138 262C139 262 139 263 139 264C139 264 138 269 138 270C138 270 138 271 137 272C137 273 137 279 137 282C138 286 140 292 142 294C143 295 143 296 144 297C145 298 150 303 152 304C152 304 153 305 154 306C157 308 162 310 166 311C168 312 170 312 170 313C171 313 172 313 172 313C173 313 174 314 175 314C176 314 178 315 187 316C192 316 209 316 213 316C215 316 217 315 218 315C222 315 230 314 232 313C232 313 234 313 235 312C239 312 244 310 245 310C245 310 250 308 254 308C256 307 258 306 260 306C261 305 262 305 262 305C263 304 264 304 264 304C264 304 265 303 266 303C267 303 271 302 273 300C274 300 276 299 276 299C277 299 278 298 279 298C281 297 284 295 285 295C286 294 287 294 287 294C288 293 289 292 291 292C292 291 294 290 294 290C295 290 295 290 295 290C295 290 296 289 296 289C297 289 297 288 298 288C299 288 300 287 303 285C303 284 305 283 306 283C307 282 308 281 309 281C309 280 310 280 311 279C315 276 316 275 318 274C320 272 325 268 328 264C329 264 330 262 332 261C335 258 338 254 341 250C341 249 343 247 344 245C345 243 345 242 346 241C346 241 346 240 346 240C347 239 349 233 349 231C349 230 349 230 346 230C343 229 342 229 343 228C343 226 346 218 346 216C347 216 348 214 348 212C349 210 350 208 350 208C350 207 351 206 351 205C353 201 354 202 356 207C356 208 360 216 361 218C363 220 365 224 366 227C367 229 366 229 362 229C357 230 357 229 356 236C356 238 356 239 356 240C355 241 355 241 355 242C355 242 354 246 353 248C353 248 352 249 352 250C352 251 351 253 350 255C349 256 349 256 349 257C349 257 345 263 343 265C343 266 342 267 341 268C339 271 338 272 338 272C338 272 337 273 336 273C335 275 330 281 328 282C327 283 325 285 324 286C323 287 322 288 321 288C321 288 320 289 319 290C318 290 317 291 316 292C316 292 314 294 313 294C312 295 311 296 311 296C310 296 307 299 305 300C304 300 303 301 302 302C301 302 300 303 299 303C297 305 293 307 291 308C290 309 288 309 288 310C287 310 286 311 285 311C284 312 282 312 281 313C279 314 277 315 276 316C275 316 273 317 271 317C270 318 268 318 268 319C267 319 266 319 266 319C265 320 256 323 253 324C251 324 250 325 249 325C245 327 235 329 233 329C233 329 232 329 232 330C230 330 218 332 215 332C214 332 212 333 212 333C206 334 192 334 186 334Z',
  'M359 277C357 276 357 276 361 275C362 275 364 275 365 274C365 274 366 274 366 274C366 274 367 273 368 273C368 273 370 272 371 272C375 270 382 264 385 259C385 258 386 257 387 257C387 255 388 252 390 246C390 242 390 230 389 225C388 224 388 222 388 221C387 220 387 218 386 217C385 212 384 211 384 210C384 209 379 199 377 196C375 193 375 192 373 189C373 189 372 187 371 186C370 185 369 183 368 182C367 180 365 178 364 176C363 176 363 175 363 175C363 174 361 173 360 172C359 170 358 169 357 168C356 167 354 164 352 162C350 160 348 158 347 157C345 155 341 151 338 149C338 149 336 147 335 147C335 146 333 145 332 144C331 143 329 142 329 141C328 141 327 140 327 140C326 139 325 138 324 138C323 137 322 136 322 136C321 136 320 135 318 134C317 133 315 131 314 130C311 128 301 122 300 122C300 123 299 122 298 121C296 121 295 120 295 120C294 120 294 120 293 119C293 119 293 119 293 119C292 119 291 118 290 117C288 117 286 116 285 115C284 115 283 114 282 114C281 114 279 113 277 112C273 111 273 111 270 110C269 110 268 109 266 109C265 108 263 108 262 108C260 107 259 107 259 107C258 107 257 107 256 107C256 106 253 106 252 106C250 106 247 106 246 105C240 105 229 106 228 108C228 108 229 111 230 112C232 115 230 115 220 117C218 117 215 118 214 118C213 118 212 118 211 118C210 118 208 119 208 119C206 120 202 120 202 120C202 119 202 119 202 119C202 118 203 117 203 117C203 116 204 115 205 114C206 113 207 111 207 110C208 109 208 108 209 107C210 106 215 98 216 97C217 94 220 94 222 98C223 101 224 102 226 101C226 100 227 100 228 100C228 100 230 99 231 98C238 95 256 94 266 97C267 97 269 97 271 98C275 98 278 99 280 100C280 100 282 101 284 101C287 102 293 104 295 105C295 105 296 106 298 106C299 107 300 108 302 108C305 110 311 113 313 114C314 114 315 115 317 116C318 117 319 118 320 118C320 118 321 119 322 119C323 120 324 121 325 121C326 122 327 123 328 123C330 124 331 125 334 127C335 128 337 129 337 129C338 129 339 130 339 131C340 131 341 132 342 133C344 134 345 135 347 137C348 137 349 139 350 139C351 140 352 141 352 141C353 142 354 143 356 144C357 145 362 150 363 151C364 152 365 153 366 154C367 155 369 157 369 158C370 159 371 160 371 160C371 160 372 160 372 161C373 162 374 163 375 164C376 165 378 168 379 169C379 170 380 171 381 172C382 173 383 174 384 175C384 176 385 177 385 178C386 178 387 179 387 180C388 181 389 183 389 184C390 184 390 185 390 185C390 185 391 186 391 186C392 187 392 188 393 190C394 191 394 192 395 192C395 192 396 194 396 195C397 196 398 198 398 199C398 199 399 201 400 202C400 204 401 205 401 206C401 206 402 207 402 207C402 207 402 207 402 208C402 208 403 209 403 210C403 211 404 213 404 214C405 215 406 220 407 222C408 225 409 239 409 240C409 240 408 242 408 244C408 248 407 250 406 253C406 254 406 254 406 255C406 255 403 260 402 261C402 261 401 262 400 263C400 264 399 265 396 268C392 271 392 271 388 272C387 273 385 274 384 274C380 276 365 278 359 277Z'
];

function ringSvg(): string {
  return (
    '<svg viewBox="83 34 340 340" aria-hidden="true">' +
    LOGO_ARROWS.map((d) => `<path fill="#A9DEF1" fill-rule="evenodd" d="${d}"/>`).join('') +
    '</svg>'
  );
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
    window.setTimeout(cleanup, 280);
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
  const ringSize = Math.min(S * 1.85, vw * 0.98);
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
    }, 450);
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
