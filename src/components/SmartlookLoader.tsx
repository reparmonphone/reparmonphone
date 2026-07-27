'use client';

import { useEffect } from 'react';
import {
  getStoredConsent,
  COOKIE_CONSENT_EVENT,
  type CookieConsent,
} from '@/lib/cookieConsent';

declare global {
  interface Window {
    smartlook?: (...args: unknown[]) => void;
  }
}

const SMARTLOOK_KEY = 'cb329294a1ce4fe4605c27fc64badd20bc75af30';

function loadSmartlook() {
  if (typeof window === 'undefined' || window.smartlook) return; // déjà chargé, ne pas dupliquer

  const w = window as unknown as { smartlook?: ((...args: unknown[]) => void) & { api?: unknown[] } };
  w.smartlook =
    w.smartlook ||
    function (...args: unknown[]) {
      (w.smartlook!.api = w.smartlook!.api || []).push(args);
    };
  const script = document.createElement('script');
  script.async = true;
  script.type = 'text/javascript';
  script.charset = 'utf-8';
  script.src = 'https://web-sdk.smartlook.com/recorder.js';
  document.head.appendChild(script);

  window.smartlook!('init', SMARTLOOK_KEY, { region: 'eu' });
}

export default function SmartlookLoader() {
  useEffect(() => {
    // Charge immédiatement si le consentement "statistiques" a déjà été donné lors d'une visite précédente
    const consent = getStoredConsent();
    if (consent?.analytics) loadSmartlook();

    // Charge dynamiquement si le visiteur accepte pendant cette visite (sans avoir besoin de recharger la page)
    function handleConsentChange(e: Event) {
      const detail = (e as CustomEvent<CookieConsent>).detail;
      if (detail?.analytics) loadSmartlook();
    }
    window.addEventListener(COOKIE_CONSENT_EVENT, handleConsentChange);
    return () => window.removeEventListener(COOKIE_CONSENT_EVENT, handleConsentChange);
  }, []);

  return null;
}
