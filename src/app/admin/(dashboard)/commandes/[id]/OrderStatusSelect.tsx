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

// Un renvoi (nouvelle expédition gratuite) n'a ni paiement ni remboursement : 4 statuts seulement.
const REPLACEMENT_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: 'PROCESSING', label: 'En préparation' },
  { value: 'SHIPPED', label: 'En livraison (expédié)' },
  { value: 'DELIVERED', label: 'Livré' },
  { value: 'CANCELLED', label: 'Annulé' },
];

export default function OrderStatusSelect({
  orderId,
  currentStatus,
  isReplacement = false,
}: {
  orderId: string;
  currentStatus: OrderStatus;
  isReplacement?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const options = isReplacement ? REPLACEMENT_OPTIONS : OPTIONS;

  return (
    <select
      defaultValue={currentStatus}
      disabled={pending}
      onChange={(e) => startTransition(() => updateOrderStatus(orderId, e.target.value as OrderStatus))}
      className="border border-gray-200 rounded-lg px-3 py-2 text-sm disabled:opacity-60"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
