'use client';

import { useState } from 'react';
import 'leaflet/dist/leaflet.css';
import LocationPicker from '@/components/LocationPicker';
import {
  RDV_AFTERNOON,
  RDV_MORNING,
  isDateFullyBlocked,
  isSlotBlocked,
  periodOfTime,
  type RdvBlockLite,
} from '@/lib/rdvAvailability';

type Zone = { cityName: string; extraFee: number };

export default function RdvForm({ zones, blocks, today }: { zones: Zone[]; blocks: RdvBlockLite[]; today: string }) {
  const [type, setType] = useState<'ATELIER' | 'DOMICILE'>('ATELIER');
  const [city, setCity] = useState(zones[0]?.cityName ?? '');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [date, setDate] = useState('');
  const [period, setPeriod] = useState<'MORNING' | 'AFTERNOON' | null>(null);
  const [time, setTime] = useState('');
  const [error, setError] = useState<string | null>(null);

  const morningBlocked = date ? isSlotBlocked(date, 'MORNING', blocks) : false;
  const afternoonBlocked = date ? isSlotBlocked(date, 'AFTERNOON', blocks) : false;
  const dayBlocked = date ? isDateFullyBlocked(date, blocks) : false;
  const range = period === 'MORNING' ? RDV_MORNING : period === 'AFTERNOON' ? RDV_AFTERNOON : null;

  function onDateChange(value: string) {
    setDate(value);
    setError(null);
    // Si le créneau déjà choisi devient indisponible à cette date, on le désélectionne
    if (value && period && isSlotBlocked(value, period, blocks)) {
      setPeriod(null);
      setTime('');
    }
  }

  function choosePeriod(p: 'MORNING' | 'AFTERNOON') {
    setPeriod(p);
    setTime(p === 'MORNING' ? RDV_MORNING.defaultTime : RDV_AFTERNOON.defaultTime);
    setError(null);
  }

  const extraFee = type === 'DOMICILE' ? zones.find((z) => z.cityName === city)?.extraFee ?? 0 : 0;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!date || !period || !time) {
      setError('Choisis une date, puis le matin ou l\u2019après-midi.');
      return;
    }
    if (isSlotBlocked(date, periodOfTime(time), blocks)) {
      setError('Ce créneau n\u2019est pas disponible, choisis un autre moment.');
      return;
    }
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
      preferredDate: `${date}T${time}`,
      ...(type === 'DOMICILE' && coords ? { latitude: coords.lat, longitude: coords.lng } : {}),
    };
    try {
      const res = await fetch('/api/rdv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setSubmitted(true);
      } else if (res.status === 409) {
        setError('Ce créneau vient d\u2019être fermé, choisis un autre jour ou un autre moment.');
      } else {
        setError('Une erreur est survenue, vérifie les champs ou réessaie dans un instant.');
      }
    } catch {
      setError('Connexion impossible, réessaie dans un instant.');
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

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">Date souhaitée</label>
          <input
            type="date"
            required
            min={today}
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2"
          />
        </div>

        {date && dayBlocked && (
          <p className="text-sm text-orange-700 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">
            Je ne suis pas disponible ce jour-là. Merci de choisir une autre date.
          </p>
        )}

        {date && !dayBlocked && (
          <div>
            <p className="block text-sm font-medium mb-1">Moment de la journée</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={morningBlocked}
                onClick={() => choosePeriod('MORNING')}
                className={`py-2.5 rounded-lg text-sm font-medium border transition ${
                  period === 'MORNING' ? 'bg-brand text-white border-brand' : 'border-gray-200 text-gray-700'
                } disabled:opacity-40 disabled:line-through disabled:cursor-not-allowed`}
              >
                🌅 Matin{morningBlocked ? ' (indisponible)' : ''}
              </button>
              <button
                type="button"
                disabled={afternoonBlocked}
                onClick={() => choosePeriod('AFTERNOON')}
                className={`py-2.5 rounded-lg text-sm font-medium border transition ${
                  period === 'AFTERNOON' ? 'bg-brand text-white border-brand' : 'border-gray-200 text-gray-700'
                } disabled:opacity-40 disabled:line-through disabled:cursor-not-allowed`}
              >
                ☀️ Après-midi{afternoonBlocked ? ' (indisponible)' : ''}
              </button>
            </div>
          </div>
        )}

        {range && !dayBlocked && (
          <div>
            <label className="block text-sm font-medium mb-1">Heure souhaitée</label>
            <input
              type="time"
              required
              min={range.min}
              max={range.max}
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2"
            />
            <p className="text-xs text-gray-500 mt-1">Indicative : on te confirme le créneau exact par e-mail ou téléphone.</p>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

      <button type="submit" disabled={loading || dayBlocked} className="w-full bg-brand text-white py-3 rounded-lg font-semibold hover:bg-brand-dark transition disabled:opacity-60">
        {loading ? 'Envoi...' : 'Envoyer la demande'}
      </button>
    </form>
  );
}
