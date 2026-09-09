'use client';

import { useState, useTransition } from 'react';
import { updateMailInRepairLogistics } from '../actions';
import type { ShippingCarrier } from '@prisma/client';

const CARRIERS: { value: ShippingCarrier; label: string }[] = [
  { value: 'CHRONOPOST', label: 'Chronopost' },
  { value: 'COLISSIMO', label: 'Colissimo' },
  { value: 'MONDIAL_RELAY', label: 'Mondial Relay' },
  { value: 'RELAIS_COLIS', label: 'Relais Colis' },
  { value: 'AUTRE', label: 'Autre' },
];

export default function MailInRepairLogisticsForm({
  repairId,
  initialInboundTracking,
  initialOutboundTracking,
  initialOutboundCarrier,
  initialAdminNote,
}: {
  repairId: string;
  initialInboundTracking: string | null;
  initialOutboundTracking: string | null;
  initialOutboundCarrier: ShippingCarrier;
  initialAdminNote: string | null;
}) {
  const [inbound, setInbound] = useState(initialInboundTracking ?? '');
  const [outbound, setOutbound] = useState(initialOutboundTracking ?? '');
  const [carrier, setCarrier] = useState<ShippingCarrier>(initialOutboundCarrier);
  const [note, setNote] = useState(initialAdminNote ?? '');
  const [isPending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await updateMailInRepairLogistics(repairId, {
        inboundTrackingNumber: inbound,
        outboundTrackingNumber: outbound,
        outboundCarrier: carrier,
        adminNote: note,
      });
      setSent(true);
      setTimeout(() => setSent(false), 3000);
    });
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5">
      <h2 className="font-semibold text-gray-800 mb-3">Logistique & note interne</h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Suivi Chronopost — envoi du client (aller) — peut être rempli automatiquement par le
              client via son lien de suivi
            </label>
            <input
              type="text"
              value={inbound}
              onChange={(e) => setInbound(e.target.value)}
              placeholder="N° de suivi aller"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Transporteur du renvoi</label>
            <select
              value={carrier}
              onChange={(e) => setCarrier(e.target.value as ShippingCarrier)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            >
              {CARRIERS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">
            Suivi du renvoi (retour) — renseigner ce champ marque automatiquement la demande comme « Renvoyé au client »
          </label>
          <input
            type="text"
            value={outbound}
            onChange={(e) => setOutbound(e.target.value)}
            placeholder="N° de suivi retour, une fois payé et réparé"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Note interne (jamais visible du client)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="bg-gray-800 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-700 transition disabled:opacity-60"
        >
          {isPending ? 'Enregistrement...' : 'Enregistrer'}
        </button>
        {sent && <span className="ml-3 text-green-600 text-sm font-medium">✓ Enregistré</span>}
      </form>
    </div>
  );
}
