'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { getStoredConsent } from '@/lib/cookieConsent';

export default function TrackVisit() {
  const pathname = usePathname();

  useEffect(() => {
    // Le site affiché dans l'aperçu de l'admin (iframe, ex. /admin/themes) ne doit pas fausser les statistiques.
    try {
      if (window.self !== window.top) return;
    } catch {
      return;
    }

    const consent = getStoredConsent();
    if (!consent?.analytics) return; // pas de consentement -> pas de tracking

    fetch('/api/track-visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: pathname }),
      keepalive: true,
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return null;
}
