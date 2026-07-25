'use client';

import { useTransition } from 'react';
import { updateAppointmentStatus } from './actions';
import type { AppointmentStatus } from '@prisma/client';

const OPTIONS: { value: AppointmentStatus; label: string }[] = [
  { value: 'REQUESTED', label: 'Demandé' },
  { value: 'CONFIRMED', label: 'Confirmé' },
  { value: 'DONE', label: 'Terminé' },
  { value: 'CANCELLED', label: 'Annulé' },
];

export default function AppointmentStatusSelect({
  appointmentId,
  currentStatus,
}: {
  appointmentId: string;
  currentStatus: AppointmentStatus;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <select
      defaultValue={currentStatus}
      disabled={pending}
      onChange={(e) => startTransition(() => updateAppointmentStatus(appointmentId, e.target.value as AppointmentStatus))}
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
