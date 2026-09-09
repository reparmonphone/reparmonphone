'use client';

import { useState } from 'react';

const INBOUND_CARRIERS: { value: 'CHRONOPOST' | 'COLISSIMO'; label: string }[] = [
  { value: 'CHRONOPOST', label: 'Chronopost' },
  { value: 'COLISSIMO', label: 'Colissimo recommandé' },
];

export default function TrackingSubmitForm({
  repairId,
  initialTrackingNumber,
  initialCarrier,
}: {
  repairId: string;
  initialTrackingNumber: string | null;
  initialCarrier: 'CHRONOPOST' | 'COLISSIMO' | 'MONDIAL_RELAY' | 'RELAIS_COLIS' | 'AUTRE' | null;
}) {
  const [value, setValue] = useState(initialTrackingNumber ?? '');
  const [carrier, setCarrier] = useState<'CHRONOPOST' | 'COLISSIMO'>(
    initialCarrier === 'COLISSIMO' ? 'COLISSIMO' : 'CHRONOPOST'
  );
  const [saved, setSaved] = useState<string | null>(initialTrackingNumber);
  const [savedCarrier, setSavedCarrier] = useState<'CHRONOPOST' | 'COLISSIMO'>(carrier);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reparation-a-distance/${repairId}/tracking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackingNumber: value, carrier }),
      });
      if (res.ok) {
        setSaved(value);
        setSavedCarrier(carrier);
      } else {
        setError('Numéro invalide ou trop court. Vérifiez et réessayez.');
      }
    } catch {
      setError("Impossible d'enregistrer pour le moment. Réessayez ou appelez-nous directement.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6">
      {saved && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
          ✅ Envoi {INBOUND_CARRIERS.find((c) => c.value === savedCarrier)?.label} enregistré, numéro de
          suivi : <strong>{saved}</strong>. Vous pouvez le corriger ci-dessous si besoin.
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Transporteur utilisé pour votre envoi
          </label>
          <div className="flex gap-3">
            {INBOUND_CARRIERS.map((c) => (
              <label
                key={c.value}
                className={`flex-1 text-center border rounded-lg px-3 py-2 text-sm cursor-pointer transition ${
                  carrier === c.value
                    ? 'border-brand bg-brand-light text-brand font-semibold'
                    : 'border-gray-200 text-gray-600'
                }`}
              >
                <input
                  type="radio"
                  name="carrier"
                  value={c.value}
                  checked={carrier === c.value}
                  onChange={() => setCarrier(c.value)}
                  className="sr-only"
                />
                {c.label}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Numéro de suivi de votre envoi
          </label>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            required
            minLength={4}
            placeholder="Ex : 8L12345678901"
            className="w-full border border-gray-200 rounded-lg px-3 py-2"
          />
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand text-white py-3 rounded-lg font-semibold hover:bg-brand-dark transition disabled:opacity-60"
        >
          {loading ? 'Enregistrement...' : saved ? 'Mettre à jour mon numéro de suivi' : 'Enregistrer mon numéro de suivi'}
        </button>
      </form>
    </div>
  );
}
