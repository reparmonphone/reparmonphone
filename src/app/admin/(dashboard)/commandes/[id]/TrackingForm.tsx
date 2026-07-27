'use client';

import { useState, useTransition } from 'react';
import { updateOrderTracking } from '../actions';
import { CARRIER_LABELS, buildTrackingUrl } from '@/lib/tracking';
import type { ShippingCarrier } from '@prisma/client';

export default function TrackingForm({
  orderId,
  carrier,
  trackingNumber,
  trackingUrlOverride,
}: {
  orderId: string;
  carrier: ShippingCarrier | null;
  trackingNumber: string;
  trackingUrlOverride: string;
}) {
  const [selectedCarrier, setSelectedCarrier] = useState<ShippingCarrier | ''>(carrier ?? '');
  const [number, setNumber] = useState(trackingNumber);
  const [overrideUrl, setOverrideUrl] = useState(trackingUrlOverride);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const previewUrl = buildTrackingUrl(selectedCarrier || null, number, overrideUrl);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await updateOrderTracking(orderId, {
        carrier: selectedCarrier || null,
        trackingNumber: number,
        trackingUrlOverride: overrideUrl,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Transporteur</label>
          <select
            value={selectedCarrier}
            onChange={(e) => setSelectedCarrier(e.target.value as ShippingCarrier | '')}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">— Aucun —</option>
            {Object.entries(CARRIER_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Numéro de suivi</label>
          <input
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="ex: 6A12345678901"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Lien de suivi personnalisé <span className="text-gray-400 font-normal">(optionnel — prioritaire sur le lien auto-généré)</span>
        </label>
        <input
          value={overrideUrl}
          onChange={(e) => setOverrideUrl(e.target.value)}
          placeholder="https://..."
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
        />
      </div>

      {previewUrl && (
        <p className="text-sm text-gray-500">
          Lien qui sera affiché au client :{' '}
          <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline break-all">
            {previewUrl}
          </a>
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="bg-brand text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-brand-dark transition disabled:opacity-60"
        >
          {pending ? 'Enregistrement...' : 'Enregistrer le suivi'}
        </button>
        {saved && <span className="text-green-600 text-sm">✅ Enregistré</span>}
      </div>
    </form>
  );
}
