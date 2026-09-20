'use client';

import { useState, useTransition } from 'react';
import { createShipment, updateShipmentTracking, deleteShipment } from './shipmentActions';
import { CARRIER_LABELS, buildTrackingUrl } from '@/lib/tracking';
import type { ShippingCarrier } from '@prisma/client';

type OrderItemInfo = {
  id: string;
  title: string;
  totalQuantity: number;
  shippedQuantity: number;
};

type ShipmentInfo = {
  id: string;
  carrier: ShippingCarrier | null;
  trackingNumber: string;
  trackingUrlOverride: string;
  createdAt: string;
  items: { orderItemId: string; title: string; quantity: number }[];
};

export default function PartialShipmentsPanel({
  orderId,
  orderItems,
  shipments,
}: {
  orderId: string;
  orderItems: OrderItemInfo[];
  shipments: ShipmentInfo[];
}) {
  const itemsWithRemaining = orderItems.map((item) => ({
    ...item,
    remaining: item.totalQuantity - item.shippedQuantity,
  }));
  const hasRemaining = itemsWithRemaining.some((i) => i.remaining > 0);

  return (
    <div className="space-y-5">
      {/* Récapitulatif de la répartition */}
      <div className="border border-gray-100 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-xs uppercase">
              <th className="text-left font-medium px-3 py-2">Article</th>
              <th className="text-center font-medium px-3 py-2">Total</th>
              <th className="text-center font-medium px-3 py-2">Expédié</th>
              <th className="text-center font-medium px-3 py-2">Restant</th>
            </tr>
          </thead>
          <tbody>
            {itemsWithRemaining.map((item) => (
              <tr key={item.id} className="border-t border-gray-100">
                <td className="px-3 py-2">{item.title}</td>
                <td className="px-3 py-2 text-center">{item.totalQuantity}</td>
                <td className="px-3 py-2 text-center">{item.shippedQuantity}</td>
                <td className="px-3 py-2 text-center font-semibold">
                  {item.remaining > 0 ? (
                    <span className="text-amber-600">{item.remaining}</span>
                  ) : (
                    <span className="text-green-600">0 ✓</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Envois déjà créés */}
      {shipments.length > 0 && (
        <div className="space-y-3">
          {shipments.map((shipment, i) => (
            <ShipmentCard key={shipment.id} shipment={shipment} index={i + 1} />
          ))}
        </div>
      )}

      {/* Nouvel envoi */}
      {hasRemaining ? (
        <NewShipmentForm orderId={orderId} itemsWithRemaining={itemsWithRemaining.filter((i) => i.remaining > 0)} />
      ) : (
        shipments.length > 0 && (
          <p className="text-sm text-green-600 bg-green-50 rounded-lg px-4 py-3">
            ✅ Tous les articles de cette commande ont été répartis dans un envoi.
          </p>
        )
      )}
    </div>
  );
}

function ShipmentCard({ shipment, index }: { shipment: ShipmentInfo; index: number }) {
  const [editing, setEditing] = useState(!shipment.trackingNumber);
  const [carrier, setCarrier] = useState<ShippingCarrier | ''>(shipment.carrier ?? '');
  const [number, setNumber] = useState(shipment.trackingNumber);
  const [overrideUrl, setOverrideUrl] = useState(shipment.trackingUrlOverride);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewUrl = buildTrackingUrl(carrier || null, number, overrideUrl);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const r = await updateShipmentTracking(shipment.id, {
        carrier: carrier || null,
        trackingNumber: number,
        trackingUrlOverride: overrideUrl,
      });
      if (r?.error) {
        setError(r.error);
      } else {
        setSaved(true);
        setEditing(false);
        setTimeout(() => setSaved(false), 2000);
      }
    });
  }

  function handleDelete() {
    if (!confirm(`Supprimer l'envoi n°${index} ? Les articles redeviendront disponibles à expédier.`)) return;
    startTransition(async () => {
      await deleteShipment(shipment.id);
    });
  }

  return (
    <div className="border border-gray-100 rounded-lg p-4 bg-gray-50/50">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="font-semibold text-sm">📦 Envoi n°{index}</p>
          <ul className="text-xs text-gray-500 mt-0.5">
            {shipment.items.map((it) => (
              <li key={it.orderItemId}>
                {it.quantity} × {it.title}
              </li>
            ))}
          </ul>
        </div>
        <button onClick={handleDelete} disabled={pending} className="text-red-500 text-xs hover:underline disabled:opacity-50 shrink-0">
          Supprimer
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2 mb-2">{error}</div>}

      {!editing ? (
        <div className="flex items-center gap-3 text-sm mt-2">
          <span className="text-gray-700">
            {carrier ? CARRIER_LABELS[carrier] : 'Transporteur non renseigné'}
            {number && (
              <>
                {' '}
                — n° <span className="font-mono">{number}</span>
              </>
            )}
          </span>
          <button type="button" onClick={() => setEditing(true)} className="text-brand text-xs hover:underline">
            Modifier
          </button>
          {saved && <span className="text-green-600 text-xs">✅ Enregistré</span>}
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-3 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Transporteur</label>
              <select
                value={carrier}
                onChange={(e) => setCarrier(e.target.value as ShippingCarrier | '')}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white"
              >
                <option value="">— Aucun —</option>
                {Object.entries(CARRIER_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Numéro de suivi</label>
              <input
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="ex: 6A12345678901"
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">
              Lien de suivi personnalisé <span className="text-gray-400 font-normal">(optionnel)</span>
            </label>
            <input
              value={overrideUrl}
              onChange={(e) => setOverrideUrl(e.target.value)}
              placeholder="https://..."
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white"
            />
          </div>
          {previewUrl && (
            <p className="text-xs text-gray-500 break-all">
              Lien affiché au client : <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">{previewUrl}</a>
            </p>
          )}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={pending}
              className="bg-brand text-white px-4 py-1.5 rounded-lg text-xs font-semibold hover:bg-brand-dark transition disabled:opacity-60"
            >
              {pending ? 'Enregistrement...' : 'Enregistrer le suivi'}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="text-gray-500 text-xs">
              Annuler
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function NewShipmentForm({
  orderId,
  itemsWithRemaining,
}: {
  orderId: string;
  itemsWithRemaining: (OrderItemInfo & { remaining: number })[];
}) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [carrier, setCarrier] = useState<ShippingCarrier | ''>('');
  const [number, setNumber] = useState('');
  const [overrideUrl, setOverrideUrl] = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  function setQty(itemId: string, value: number, max: number) {
    const clamped = Math.max(0, Math.min(value, max));
    setQuantities((prev) => ({ ...prev, [itemId]: clamped }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const items = itemsWithRemaining
      .map((item) => ({ orderItemId: item.id, quantity: quantities[item.id] || 0 }))
      .filter((i) => i.quantity > 0);

    if (items.length === 0) {
      setError('Renseignez la quantité d’au moins un article pour cet envoi.');
      return;
    }

    startTransition(async () => {
      const r = await createShipment(orderId, {
        carrier: carrier || null,
        trackingNumber: number,
        trackingUrlOverride: overrideUrl,
        items,
      });
      if (r?.error) {
        setError(r.error);
      } else {
        setQuantities({});
        setCarrier('');
        setNumber('');
        setOverrideUrl('');
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full border border-dashed border-gray-300 rounded-lg py-3 text-sm text-gray-500 hover:border-brand hover:text-brand transition"
      >
        + Ajouter un envoi
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="border border-gray-200 rounded-lg p-4 space-y-3">
      <p className="font-semibold text-sm">📦 Nouvel envoi</p>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">{error}</div>}

      <div className="space-y-2">
        {itemsWithRemaining.map((item) => (
          <div key={item.id} className="flex items-center gap-3">
            <span className="flex-1 text-sm">{item.title} <span className="text-gray-400 text-xs">(reste {item.remaining})</span></span>
            <input
              type="number"
              min={0}
              max={item.remaining}
              value={quantities[item.id] ?? 0}
              onChange={(e) => setQty(item.id, parseInt(e.target.value, 10) || 0, item.remaining)}
              className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center"
            />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1">Transporteur</label>
          <select
            value={carrier}
            onChange={(e) => setCarrier(e.target.value as ShippingCarrier | '')}
            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
          >
            <option value="">— Aucun —</option>
            {Object.entries(CARRIER_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Numéro de suivi</label>
          <input
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="ex: 6A12345678901 (facultatif pour l'instant)"
            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium mb-1">
          Lien de suivi personnalisé <span className="text-gray-400 font-normal">(optionnel)</span>
        </label>
        <input
          value={overrideUrl}
          onChange={(e) => setOverrideUrl(e.target.value)}
          placeholder="https://..."
          className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
        />
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="bg-brand text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-brand-dark transition disabled:opacity-60"
        >
          {pending ? 'Création...' : "Créer l'envoi"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-gray-500 text-sm">
          Annuler
        </button>
      </div>
      <p className="text-xs text-gray-400">
        Vous pourrez renseigner ou modifier le numéro de suivi plus tard si l’article n’est pas encore prêt à partir.
      </p>
    </form>
  );
}
