'use client';

import { useEffect, useState } from 'react';
import { MODE_SOMBRE_ACTIF } from '@/data/options';

// Bouton clair / sombre. Le choix est mémorisé (localStorage) et appliqué avant l'affichage par un petit
// script du layout, pour éviter un flash blanc. Jamais automatique : le site reste clair par défaut.
export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.getAttribute('data-theme') === 'dark');
  }, []);

  if (!MODE_SOMBRE_ACTIF) return null;

  function toggle() {
    const next = !dark;
    setDark(next);
    const root = document.documentElement;
    if (next) root.setAttribute('data-theme', 'dark');
    else root.removeAttribute('data-theme');
    try {
      localStorage.setItem('rmp-theme', next ? 'dark' : 'light');
    } catch {
      /* navigation privée : le choix ne sera juste pas mémorisé */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Passer en mode clair' : 'Passer en mode sombre'}
      aria-pressed={dark}
      title={dark ? 'Mode clair' : 'Mode sombre'}
      className="rounded-full px-1.5 text-sm leading-none hover:text-white"
      suppressHydrationWarning
    >
      {dark ? '☀️' : '🌙'}
    </button>
  );
}
