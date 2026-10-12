// Effets du bouton "Ajouter au panier" (appelés depuis AddToCartButton.tsx) :
//  - une onde qui part du point de clic
//  - la photo du produit vole jusqu'à l'icône du panier (en haut), qui "rebondit" à l'arrivée
// Rien ne se joue si le visiteur a demandé "moins d'animations".

const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function rippleAt(button: HTMLElement, clientX: number, clientY: number) {
  if (reduced()) return;
  const r = button.getBoundingClientRect();
  const span = document.createElement('span');
  span.className = 'atc-ripple';
  // clic au clavier : clientX/Y valent 0 → on part du centre du bouton
  const x = clientX || clientY ? clientX - r.left : r.width / 2;
  const y = clientX || clientY ? clientY - r.top : r.height / 2;
  span.style.left = `${x}px`;
  span.style.top = `${y}px`;
  button.appendChild(span);
  span.addEventListener('animationend', () => span.remove());
  window.setTimeout(() => span.remove(), 900);
}

export function flyToCart(from: HTMLElement, imageUrl: string | null) {
  if (reduced() || !imageUrl) return;
  const cart = document.querySelector<HTMLElement>('header a[href="/panier"]');
  if (!cart) return;

  // départ : la photo principale si elle est visible à l'écran, sinon le bouton
  const main = document.querySelector<HTMLElement>('[data-pt-target]');
  let a = from.getBoundingClientRect();
  if (main) {
    const m = main.getBoundingClientRect();
    if (m.bottom > 80 && m.top < window.innerHeight) a = m;
  }
  const b = cart.getBoundingClientRect();
  const size = 64;
  const sx = a.left + a.width / 2;
  const sy = a.top + a.height / 2;
  const dx = b.left + b.width / 2 - sx;
  const dy = b.top + b.height / 2 - sy;

  const outer = document.createElement('div');
  outer.className = 'cart-fly';
  outer.style.cssText = `left:${sx - size / 2}px;top:${sy - size / 2}px;width:${size}px;height:${size}px`;
  const inner = document.createElement('div');
  const img = new Image();
  img.alt = '';
  img.src = imageUrl;
  inner.appendChild(img);
  outer.appendChild(inner);
  document.body.appendChild(outer);

  // Deux animations indépendantes (horizontale rapide, verticale retardée) = trajectoire en arc
  const dur = 950;
  outer.animate(
    [{ transform: 'translateX(0)' }, { transform: `translateX(${dx}px)` }],
    { duration: dur, easing: 'cubic-bezier(0.2, 0.6, 0.3, 1)', fill: 'forwards' },
  );
  const anim = inner.animate(
    [
      { transform: 'translateY(0) scale(1.15) rotate(0deg)' },
      { transform: `translateY(${dy}px) scale(0.28) rotate(300deg)` },
    ],
    { duration: dur, easing: 'cubic-bezier(0.55, 0, 0.9, 0.5)', fill: 'forwards' },
  );
  const done = () => {
    outer.remove();
    cart.classList.add('cart-bump');
    window.setTimeout(() => cart.classList.remove('cart-bump'), 700);
  };
  anim.onfinish = done;
  window.setTimeout(() => outer.isConnected && done(), dur + 400);
}
