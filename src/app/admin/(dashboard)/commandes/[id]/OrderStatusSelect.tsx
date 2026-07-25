'use client';

import { useTransition } from 'react';
import { updateOrderStatus } from '../actions';
import type { OrderStatus } from '@prisma/client';

const OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: 'PENDING', label: 'En attente' },
  { value: 'PAID', label: 'Payée' },
  { value: 'PROCESSING', label: 'En préparation' },
  { value: 'SHIPPED', label: 'Expédiée' },
  { value: 'DELIVERED', label: 'Livrée' },
  { value: 'CANCELLED', label: 'Annulée' },
  { value: 'REFUNDED', label: 'Remboursée' },
];

export default function OrderStatusSelect({ orderId, currentStatus }: { orderId: string; currentStatus: OrderStatus }) {
  const [pending, startTransition] = useTransition();

  return (
    <select
      defaultValue={currentStatus}
      disabled={pending}
      onChange={(e) => startTransition(() => updateOrderStatus(orderId, e.target.value as OrderStatus))}
      className="border border-gray-200 rounded-lg px-3 py-2 text-sm disabled:opacity-60"
    >
      {OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
