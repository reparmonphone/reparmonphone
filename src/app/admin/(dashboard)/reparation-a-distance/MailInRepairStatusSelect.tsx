'use client';

import { useTransition } from 'react';
import { updateMailInRepairStatus } from './actions';
import type { MailInRepairStatus } from '@prisma/client';

const OPTIONS: { value: MailInRepairStatus; label: string }[] = [
  { value: 'REQUESTED', label: 'Demandé' },
  { value: 'AWAITING_DEVICE', label: "En attente de l'appareil" },
  { value: 'DEVICE_RECEIVED', label: 'Appareil reçu' },
  { value: 'AWAITING_PAYMENT', label: 'En attente de paiement' },
  { value: 'PAID', label: 'Payé' },
  { value: 'SHIPPED_BACK', label: 'Renvoyé au client' },
  { value: 'CANCELLED', label: 'Annulé' },
];

export default function MailInRepairStatusSelect({
  repairId,
  currentStatus,
}: {
  repairId: string;
  currentStatus: MailInRepairStatus;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <select
      defaultValue={currentStatus}
      disabled={pending}
      onChange={(e) => startTransition(() => updateMailInRepairStatus(repairId, e.target.value as MailInRepairStatus))}
      className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs disabled:opacity-60"
    >
      {OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
