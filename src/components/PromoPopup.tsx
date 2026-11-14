'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import PromoPopupView from './PromoPopupView';
import type { PromoPayload } from '@/lib/promoPopup';
import { COOKIE_CONSENT_EVENT, getStoredConsent } from '@/lib/cookieConsent';

// Pop-up d'ouverture du site (offre à mettre en avant). Se règle dans /admin/popup.
// Règles pour rester respectueux des visiteurs (et de Google, qui n'aime pas les pop-ups intrusifs) :
//  - apparaît après le délai choisi, et après la réponse à la bannière cookies (au plus tard 15 s) ;
//  - jamais dans l'admin, le panier, le paiement, le compte, la prise de rendez-vous, la maintenance,
//    ni sur la page de l'offre elle-même ;
//  - jamais en même temps que le pop-up « Mode vacances » ;
//  - une fois fermé, ne revient pas avant le nombre de jours choisi (ou pas avant la prochaine visite si 0) ;
//  - se ferme avec la croix, « Non merci », la touche Échap ou un clic en dehors.

const EXCLUDED_PREFIXES = ['/admin', '/checkout', '/panier', '/compte', '/rdv', '/maintenance'];
const KEY_PREFIX = 'rmp_promo_popup_';

function pushEvent(event: string, params: Record<string, unknown> = {}) {
  const w = window as unknown as { dataLayer?: unknown[] };
  w.dataLayer = w.dataLayer || [];
  w.dataLayer.push({ event, ...params });
}

function alreadySeen(version: string, repeatDays: number): boolean {
  try {
    if (sessionStorage.getItem(KEY_PREFIX + version)) return true;
    if (repeatDays > 0) {
      const at = Number(localStorage.getItem(KEY_PREFIX + version));
      if (Number.isFinite(at) && at > 0 && Date.now() - at < repeatDays * 86_400_000) return true;
    }
  } catch {
    // stockage indisponible : on s'en tient à « une fois par chargement de page »
  }
  return false;
}

function markSeen(version: string) {
  try {
    sessionStorage.setItem(KEY_PREFIX + version, '1');
    localStorage.setItem(KEY_PREFIX + version, String(Date.now()));
  } catch {
    // pas bloquant
  }
}

export default function PromoPopup() {
  const pathname = usePathname() ?? '/';
  const [data, setData] = useState<PromoPayload | null>(null);
  const [open, setOpen] = useState(false);
  const fetched = useRef(false);
  const shown = useRef(false); // une seule apparition par chargement de page, même après fermeture

  const excluded = EXCLUDED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  // 1) Lecture de la configuration (une seule fois par chargement de page)
  useEffect(() => {
    if (excluded || fetched.current) return;
    fetched.current = true;
    let cancelled = false;
    fetch('/api/popup')
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const p = json?.popup as PromoPayload | null | undefined;
        if (cancelled || !p || !p.title || !p.ctaHref) return;
        if (alreadySeen(p.version, p.repeatDays)) return;
        setData(p);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [excluded]);

  // 2) Ouverture différée, après la bannière cookies
  useEffect(() => {
    if (!data || excluded || open || shown.current) return;
    // la page de l'offre elle-même : inutile de la proposer
    const target = data.ctaHref.split(/[?#]/)[0];
    if (target === pathname) return;

    let timer: number | undefined;
    let fallback: number | undefined;
    let done = false;

    const show = () => {
      if (done) return;
      done = true;
      shown.current = true;
      // Le pop-up « Mode vacances » est prioritaire : on ne superpose rien à son message.
      if (document.querySelector('.vac-overlay')) return;
      setOpen(true);
      markSeen(data.version);
      pushEvent('promo_popup_view', { popup_title: data.title });
    };
    const afterDelay = () => {
      if (getStoredConsent()) show();
      else {
        // bannière cookies pas encore traitée : on attend sa réponse, au plus 15 s
        window.addEventListener(COOKIE_CONSENT_EVENT, onConsent, { once: true });
        fallback = window.setTimeout(show, 15_000);
      }
    };
    const onConsent = () => {
      window.clearTimeout(fallback);
      timer = window.setTimeout(show, 1500);
    };
    timer = window.setTimeout(afterDelay, data.delaySeconds * 1000);

    return () => {
      done = true;
      window.clearTimeout(timer);
      window.clearTimeout(fallback);
      window.removeEventListener(COOKIE_CONSENT_EVENT, onConsent);
    };
  }, [data, excluded, open, pathname]);

  // Échap pour fermer
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Si le visiteur change de page vers une zone exclue, on referme
  useEffect(() => {
    if (excluded) setOpen(false);
  }, [excluded]);

  if (!open || !data || excluded) return null;
  return (
    <PromoPopupView
      data={data}
      onClose={() => setOpen(false)}
      onCta={() => {
        pushEvent('promo_popup_click', { popup_title: data.title });
        setOpen(false);
      }}
    />
  );
}
