'use client';

// Point d'entrée des thèmes saisonniers, monté une seule fois dans app/layout.tsx.
//  - Visiteur normal : lit /api/theme (petit JSON mis en cache 60 s) et, s'il y a un thème actif,
//    charge à la demande le code de ce thème. Sans thème actif, rien d'autre n'est téléchargé.
//  - Aperçu admin : la page /admin/themes affiche le site dans une iframe (?rmp-theme-preview=1) et lui
//    envoie le thème et les options choisis par message (même domaine uniquement). Rien n'est
//    enregistré ni visible des visiteurs tant que Krys n'a pas activé le thème.

import { useEffect, useState, type ComponentType } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { getTheme, type PublicTheme, type ThemeId, type ThemeOptions } from '@/lib/seasonalThemes';

// quiet = pages de paiement : seulement l'ambiance, sans éléments qui bougent ni bandeau (on ne distrait pas un client qui paie)
type ThemeProps = { options: ThemeOptions; preview: boolean; quiet: boolean };

const HalloweenTheme = dynamic(() => import('./HalloweenTheme'), { ssr: false });

// Un thème = une entrée ici (voir seasonalThemes.ts pour la marche à suivre).
const THEME_COMPONENTS: Record<ThemeId, ComponentType<ThemeProps>> = {
  halloween: HalloweenTheme,
};

export default function SeasonalTheme() {
  const [theme, setTheme] = useState<PublicTheme>(null);
  const [preview, setPreview] = useState(false);
  const pathname = usePathname() ?? '/';

  useEffect(() => {
    let inFrame = false;
    try {
      inFrame = window.parent !== window && new URLSearchParams(window.location.search).has('rmp-theme-preview');
    } catch {
      inFrame = false;
    }

    if (inFrame) {
      setPreview(true);
      const onMessage = (e: MessageEvent) => {
        if (e.origin !== window.location.origin || e.source !== window.parent) return;
        const d = e.data as { type?: string; theme?: PublicTheme } | null;
        if (!d || d.type !== 'rmp-theme') return;
        const t = d.theme;
        setTheme(t && typeof t === 'object' && getTheme(t.themeId) && t.options ? t : null);
      };
      window.addEventListener('message', onMessage);
      window.parent.postMessage({ type: 'rmp-theme-ready' }, window.location.origin);
      return () => window.removeEventListener('message', onMessage);
    }

    let cancelled = false;
    fetch('/api/theme')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!cancelled && j?.theme && getTheme(j.theme.themeId)) setTheme(j.theme as PublicTheme);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Jamais dans l'administration
  if (!theme || pathname.startsWith('/admin')) return null;
  const Component = THEME_COMPONENTS[theme.themeId];
  if (!Component) return null;
  return <Component options={theme.options} preview={preview} quiet={pathname.startsWith('/panier') || pathname.startsWith('/checkout')} />;
}
