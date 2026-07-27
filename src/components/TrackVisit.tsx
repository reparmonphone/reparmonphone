'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function TrackVisit() {
  const pathname = usePathname();

  useEffect(() => {
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
