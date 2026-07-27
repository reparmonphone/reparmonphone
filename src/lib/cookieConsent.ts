export const COOKIE_CONSENT_KEY = 'rmp_cookie_consent';
export const COOKIE_CONSENT_EVENT = 'rmp_cookie_consent_changed';
export const COOKIE_CONSENT_REOPEN_EVENT = 'rmp_cookie_consent_reopen';

export type CookieConsent = {
  essential: true; // toujours actifs, pas de choix possible (panier, connexion...)
  analytics: boolean; // notre compteur de visites interne
};

export function getStoredConsent(): CookieConsent | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(COOKIE_CONSENT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredConsent(consent: CookieConsent) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(consent));
  window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_EVENT, { detail: consent }));
}
