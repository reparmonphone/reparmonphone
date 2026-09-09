'use client';

import { useState } from 'react';

export default function TrackingSubmitForm({
  repairId,
  initialTrackingNumber,
}: {
  repairId: string;
  initialTrackingNumber: string | null;
}) {
  const [value, setValue] = useState(initialTrackingNumber ?? '');
  const [saved, setSaved] = useState<string | null>(initialTrackingNumber);
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
        body: JSON.stringify({ trackingNumber: value }),
      });
      if (res.ok) {
        setSaved(value);
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
          ✅ Numéro de suivi enregistré : <strong>{saved}</strong>. Vous pouvez le corriger ci-dessous si besoin.
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">
          Numéro de suivi Chronopost de votre envoi
        </label>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          required
          minLength={4}
          placeholder="Ex : 8L12345678901"
          className="w-full border border-gray-200 rounded-lg px-3 py-2"
        />
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
