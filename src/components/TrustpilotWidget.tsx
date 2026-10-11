'use client';

import { useEffect, useRef, useState } from 'react';
import { COOKIE_CONSENT_EVENT, getStoredConsent } from '@/lib/cookieConsent';

// Widget Trustpilot "Review Collector" (logo + étoiles + invitation à laisser un avis), affiché dans
// le pied de page. Identifiants fournis par Trustpilot (Business > Intégrations > TrustBox).
const TRUSTPILOT_TEMPLATE_ID = '56278e9abfbbba0bdcd568bc';
const TRUSTPILOT_BUSINESS_UNIT_ID = '6acb9dbe9e3877342108b665';
const TRUSTPILOT_TOKEN = '9900c167-7b7c-4cf6-b74a-7b19994d232f';
const TRUSTPILOT_PAGE_URL = 'https://fr.trustpilot.com/review/reparmonphone.fr';
const TRUSTPILOT_SCRIPT_SRC = 'https://widget.trustpilot.com/bootstrap/v5/tp.widget.bootstrap.min.js';

type TrustpilotGlobal = { loadFromElement: (el: HTMLElement, force?: boolean) => void };

declare global {
  interface Window {
    Trustpilot?: TrustpilotGlobal;
  }
}

// Le script Trustpilot est un service tiers : comme Smartlook et Google Tag Manager, on ne le charge
// qu'après le consentement du visiteur (choix "Statistiques" du bandeau cookies). Sans consentement,
// le visiteur voit tout de même un simple lien (sans aucun script) vers ta page d'avis Trustpilot.
export default function TrustpilotWidget() {
  const boxRef = useRef<HTMLDivElement>(null);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const sync = () => setAllowed(getStoredConsent()?.analytics === true);
    sync();
    window.addEventListener(COOKIE_CONSENT_EVENT, sync);
    return () => window.removeEventListener(COOKIE_CONSENT_EVENT, sync);
  }, []);

  useEffect(() => {
    if (!allowed || !boxRef.current) return;
    const box = boxRef.current;
    const render = () => window.Trustpilot?.loadFromElement(box, true);

    if (window.Trustpilot) {
      render();
      return;
    }
    let script = document.querySelector<HTMLScriptElement>(`script[src="${TRUSTPILOT_SCRIPT_SRC}"]`);
    if (!script) {
      script = document.createElement('script');
      script.src = TRUSTPILOT_SCRIPT_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
    script.addEventListener('load', render);
    return () => script?.removeEventListener('load', render);
  }, [allowed]);

  return (
    <div
      ref={boxRef}
      className="trustpilot-widget"
      data-locale="fr-FR"
      data-template-id={TRUSTPILOT_TEMPLATE_ID}
      data-businessunit-id={TRUSTPILOT_BUSINESS_UNIT_ID}
      data-style-height="52px"
      data-style-width="100%"
      data-theme="dark"
      data-token={TRUSTPILOT_TOKEN}
      suppressHydrationWarning
    >
      <a
        href={TRUSTPILOT_PAGE_URL}
        target="_blank"
        rel="noopener"
        className="inline-flex items-center gap-2 bg-gray-800 hover:bg-gray-700 transition rounded-lg px-3 py-2 text-xs text-white"
      >
        <span className="text-[#00b67a]">★</span>
        Évalue-nous sur Trustpilot
      </a>
    </div>
  );
}
