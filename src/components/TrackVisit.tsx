'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { getStoredConsent } from '@/lib/cookieConsent';

export default function TrackVisit() {
  const pathname = usePathname();

  useEffect(() => {
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
