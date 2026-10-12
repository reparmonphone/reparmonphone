'use client';

import { useEffect, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';

// Déclenche les animations d'apparition (classes .rv-* dans globals.css) quand le bloc entre à l'écran.
// Les enfants portent la classe "rv-i" (invisible tant que le bloc n'est pas apparu) ;
// --b = retard de ce bloc (pour que les cartes arrivent l'une après l'autre).
export default function RevealOnScroll({
  children,
  className = '',
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      el.classList.add('rv-in');
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.classList.add('rv-in');
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' },
    );
    io.observe(el);
    // Filet de sécurité : si rien ne se déclenche, on affiche quand même le contenu
    const safety = window.setTimeout(() => el.classList.add('rv-in'), 15000);
    return () => {
      io.disconnect();
      window.clearTimeout(safety);
    };
  }, []);

  return (
    <div ref={ref} className={`rv ${className}`.trim()} style={{ '--b': `${delay}s` } as CSSProperties}>
      {children}
    </div>
  );
}
