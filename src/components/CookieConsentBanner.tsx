'use client';

import { useEffect, useState } from 'react';
import {
  getStoredConsent,
  setStoredConsent,
  COOKIE_CONSENT_REOPEN_EVENT,
  type CookieConsent,
} from '@/lib/cookieConsent';

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [analyticsChecked, setAnalyticsChecked] = useState(true);

  useEffect(() => {
    if (!getStoredConsent()) setVisible(true);

    function handleReopen() {
      setCustomizing(true);
      setVisible(true);
    }
    window.addEventListener(COOKIE_CONSENT_REOPEN_EVENT, handleReopen);
    return () => window.removeEventListener(COOKIE_CONSENT_REOPEN_EVENT, handleReopen);
  }, []);

  function saveConsent(consent: CookieConsent) {
    setStoredConsent(consent);
    setVisible(false);
    setCustomizing(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-6">
          {!customizing ? (
            <>
              <p className="text-sm text-gray-700 mb-5 leading-relaxed">
                🍪 Nous utilisons des cookies essentiels au fonctionnement du site (panier, compte client) et, si
                tu l&apos;acceptes, des outils de mesure d&apos;audience et d&apos;analyse de navigation
                (compteur de visite interne, et enregistrement vidéo anonymisé de session via Smartlook) pour
                nous aider à améliorer le site. Aucune donnée n&apos;est revendue ni partagée avec des régies
                publicitaires tierces.{' '}
                <a href="/confidentialite" className="text-brand hover:underline">
                  En savoir plus
                </a>
                .
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => saveConsent({ essential: true, analytics: true })}
                  className="flex-1 bg-brand text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-brand-dark transition"
                >
                  Tout accepter
                </button>
                <button
                  onClick={() => saveConsent({ essential: true, analytics: false })}
                  className="flex-1 border border-gray-300 text-gray-700 px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-50 transition"
                >
                  Tout refuser
                </button>
              </div>
              <div className="text-center mt-3">
                <button
                  onClick={() => setCustomizing(true)}
                  className="text-gray-500 px-5 py-2 text-sm font-medium hover:underline"
                >
                  Personnaliser
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 className="font-bold text-gray-800 mb-3">Préférences cookies</h2>
              <div className="space-y-3 mb-5">
                <label className="flex items-start gap-3 text-sm">
                  <input type="checkbox" checked disabled className="mt-0.5" />
                  <span>
                    <span className="font-medium text-gray-800">Essentiels (toujours actifs)</span>
                    <span className="block text-gray-500">
                      Nécessaires au panier, à la connexion à ton compte et au paiement — le site ne peut pas
                      fonctionner sans eux.
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-3 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={analyticsChecked}
                    onChange={(e) => setAnalyticsChecked(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="font-medium text-gray-800">Statistiques de visite</span>
                    <span className="block text-gray-500">
                      Compteur de visite interne et enregistrement vidéo anonymisé de navigation (Smartlook) —
                      pas de partage avec des tiers, pas de profilage publicitaire.
                    </span>
                  </span>
                </label>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => saveConsent({ essential: true, analytics: analyticsChecked })}
                  className="flex-1 bg-brand text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-brand-dark transition"
                >
                  Enregistrer mes choix
                </button>
                <button
                  onClick={() => setCustomizing(false)}
                  className="flex-1 border border-gray-300 text-gray-700 px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-50 transition"
                >
                  Retour
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
