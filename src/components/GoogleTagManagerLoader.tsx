'use client';

import { useEffect } from 'react';
import { getStoredConsent, COOKIE_CONSENT_EVENT, type CookieConsent } from '@/lib/cookieConsent';

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

// Même identifiant que celui du conteneur GTM de Krys, "REPAR MON PHONE" (compte reparmonphone@gmail.com)
// — à changer ici seulement si elle recrée un jour un nouveau conteneur GTM.
const GTM_ID = 'GTM-58XQM4FG';

// Chargé seulement si le consentement "statistiques" a été donné (même règle que Smartlook, voir
// SmartlookLoader.tsx) : GTM sert de conteneur à d'éventuelles balises de mesure/publicité, donc on
// ne le charge pas avant que le visiteur ait accepté depuis le bandeau cookies.
function loadGtm() {
  if (typeof window === 'undefined' || document.getElementById('gtm-script')) return; // déjà chargé, ne pas dupliquer

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });

  const script = document.createElement('script');
  script.id = 'gtm-script';
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`;
  document.head.appendChild(script);
}

export default function GoogleTagManagerLoader() {
  useEffect(() => {
    // Charge immédiatement si le consentement a déjà été donné lors d'une visite précédente
    const consent = getStoredConsent();
    if (consent?.analytics) loadGtm();

    // Charge dynamiquement si le visiteur accepte pendant cette visite (sans recharger la page)
    function handleConsentChange(e: Event) {
      const detail = (e as CustomEvent<CookieConsent>).detail;
      if (detail?.analytics) loadGtm();
    }
    window.addEventListener(COOKIE_CONSENT_EVENT, handleConsentChange);
    return () => window.removeEventListener(COOKIE_CONSENT_EVENT, handleConsentChange);
  }, []);

  return null;
}
