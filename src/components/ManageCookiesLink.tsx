'use client';

import { COOKIE_CONSENT_REOPEN_EVENT } from '@/lib/cookieConsent';

export default function ManageCookiesLink() {
  return (
    <button
      onClick={() => window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_REOPEN_EVENT))}
      className="hover:text-white transition"
    >
      Gérer les cookies
    </button>
  );
}
