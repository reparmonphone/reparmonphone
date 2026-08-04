'use client';

import { useState } from 'react';
import 'leaflet/dist/leaflet.css';
import LocationPicker from '@/components/LocationPicker';

type Zone = { cityName: string; extraFee: number };

export default function RdvForm({ zones }: { zones: Zone[] }) {
  const [type, setType] = useState<'ATELIER' | 'DOMICILE'>('ATELIER');
  const [city, setCity] = useState(zones[0]?.cityName ?? '');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  const extraFee = type === 'DOMICILE' ? zones.find((z) => z.cityName === city)?.extraFee ?? 0 : 0;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const payload = {
      customerName: form.get('customerName'),
      customerEmail: form.get('customerEmail'),
      customerPhone: form.get('customerPhone'),
      deviceBrand: form.get('deviceBrand'),
      deviceModel: form.get('deviceModel'),
      issueDescription: form.get('issueDescription'),
      type,
      city,
      preferredDate: form.get('preferredDate'),
      ...(type === 'DOMICILE' && coords ? { latitude: coords.lat, longitude: coords.lng } : {}),
    };
    try {
      const res = await fetch('/api/rdv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) setSubmitted(true);
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="text-center py-12">
        <div className="text-5xl mb-4">✅</div>
        <h2 className="text-2xl font-bold mb-2">Demande de RDV envoyée !</h2>
        <p className="text-gray-600">On vous recontacte rapidement pour confirmer le créneau.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-xl border border-gray-100">
      <div className="grid grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => setType('ATELIER')}
          className={`py-3 rounded-lg font-medium border ${type === 'ATELIER' ? 'bg-brand text-white border-brand' : 'border-gray-200 text-gray-600'}`}
        >
          🔧 En atelier
        </button>
        <button
          type="button"
          onClick={() => setType('DOMICILE')}
          className={`py-3 rounded-lg font-medium border ${type === 'DOMICILE' ? 'bg-brand text-white border-brand' : 'border-gray-200 text-gray-600'}`}
        >
          🏠 À domicile
        </button>
      </div>

      {type === 'DOMICILE' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Ville</label>
            <select value={city} onChange={(e) => setCity(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2">
              {zones.map((z) => (
                <option key={z.cityName} value={z.cityName}>
                  {z.cityName}{z.extraFee > 0 ? ` (+${z.extraFee}€)` : ''}
                </option>
              ))}
            </select>
            {extraFee > 0 && <p className="text-sm text-orange-600 mt-1">Frais de déplacement : +{extraFee}€</p>}
          </div>

          <LocationPicker onChange={(lat, lng) => setCoords({ lat, lng })} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <input name="customerName" required placeholder="Nom complet" className="border border-gray-200 rounded-lg px-3 py-2" />
        <input name="customerPhone" required placeholder="Téléphone" className="border border-gray-200 rounded-lg px-3 py-2" />
      </div>
      <input name="customerEmail" required type="email" placeholder="E-mail" className="w-full border border-gray-200 rounded-lg px-3 py-2" />

      <div className="grid grid-cols-2 gap-4">
        <input name="deviceBrand" required placeholder="Marque (ex: Apple)" className="border border-gray-200 rounded-lg px-3 py-2" />
        <input name="deviceModel" required placeholder="Modèle (ex: iPhone 14)" className="border border-gray-200 rounded-lg px-3 py-2" />
      </div>

      <textarea name="issueDescription" required placeholder="Décrivez la panne..." rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2" />

      <div>
        <label className="block text-sm font-medium mb-1">Date souhaitée</label>
        <input name="preferredDate" required type="datetime-local" className="w-full border border-gray-200 rounded-lg px-3 py-2" />
      </div>

      <button type="submit" disabled={loading} className="w-full bg-brand text-white py-3 rounded-lg font-semibold hover:bg-brand-dark transition disabled:opacity-60">
        {loading ? 'Envoi...' : 'Envoyer la demande'}
      </button>
    </form>
  );
}
