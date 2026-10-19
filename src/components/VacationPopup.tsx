'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import VacationPopupView from './VacationPopupView';
import type { VacationPayload } from '@/lib/vacationShared';

// Pop-up « Mode vacances » du site public. Les dates et textes se règlent dans l'admin (Mode vacances) ;
// le pop-up apparaît et disparaît tout seul. Une fois fermé, il ne revient pas pendant la visite (sauf si tu
// modifies le message). Jamais affiché dans l'admin, sur la page maintenance ni sur la confirmation de paiement.

const EXCLUDED_PREFIXES = ['/admin', '/maintenance', '/checkout'];
const STORAGE_PREFIX = 'rmp_vacation_closed_';

export default function VacationPopup() {
  const pathname = usePathname();
  const [data, setData] = useState<VacationPayload | null>(null);
  const [open, setOpen] = useState(false);

  const excluded = EXCLUDED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  useEffect(() => {
    if (excluded || data) return;
    let cancelled = false;
    fetch('/api/vacances')
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (cancelled || !json?.active) return;
        let closed = false;
        try {
          closed = !!sessionStorage.getItem(STORAGE_PREFIX + json.version);
        } catch {
          // stockage indisponible : on affiche (une fois par chargement)
        }
        if (closed) return;
        setData(json as VacationPayload);
        setTimeout(() => !cancelled && setOpen(true), 600);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [excluded, data]);

  function close() {
    setOpen(false);
    if (!data) return;
    try {
      sessionStorage.setItem(STORAGE_PREFIX + data.version, '1');
    } catch {
      // pas bloquant
    }
  }

  if (!open || !data || excluded) return null;
  return <VacationPopupView data={data} onClose={close} />;
}
