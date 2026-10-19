'use client';

import { useState } from 'react';
import 'leaflet/dist/leaflet.css';
import LocationPicker from '@/components/LocationPicker';
import { formatDayLong, formatRange } from '@/lib/vacationShared';
import {
  addDays,
  RDV_AFTERNOON,
  RDV_MORNING,
  bookedTimesOn,
  findBookingConflict,
  isDateFullyBlocked,
  isSlotBlocked,
  periodOfTime,
  type BookedLite,
  type RdvBlockLite,
} from '@/lib/rdvAvailability';

type Zone = { cityName: string; extraFee: number };

const CONFLICT_MESSAGE =
  'Un rendez-vous est déjà prévu à cette heure-là. Merci de décaler votre demande : choisissez une autre heure ou un autre jour.';

export default function RdvForm({
  zones,
  blocks,
  booked,
  vacation,
  today,
}: {
  zones: Zone[];
  blocks: RdvBlockLite[];
  booked: BookedLite[];
  vacation: { start: string; end: string } | null;
  today: string;
}) {
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
  const onVacation = !!(vacation && date && date >= vacation.start && date <= vacation.end);
  const dayBlocked = onVacation || (date ? isDateFullyBlocked(date, blocks) : false);
  const range = period === 'MORNING' ? RDV_MORNING : period === 'AFTERNOON' ? RDV_AFTERNOON : null;
  const takenToday = date ? bookedTimesOn(date, booked) : [];
  const conflict = date && time ? findBookingConflict(date, time, booked) : null;

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
    // Créneau fermé : on explique pourquoi au lieu de ne rien faire
    if ((p === 'MORNING' && morningBlocked) || (p === 'AFTERNOON' && afternoonBlocked)) {
      const label = p === 'MORNING' ? 'Le matin' : 'L\u2019après-midi';
      const otherBlocked = p === 'MORNING' ? afternoonBlocked : morningBlocked;
      setError(
        `${label} n\u2019est pas disponible ce jour-là. ` +
          (otherBlocked
            ? 'Merci de choisir une autre date.'
            : `Vous pouvez choisir ${p === 'MORNING' ? 'l\u2019après-midi' : 'le matin'}, ou une autre date.`)
      );
      return;
    }
    setPeriod(p);
    setTime(p === 'MORNING' ? RDV_MORNING.defaultTime : RDV_AFTERNOON.defaultTime);
    setError(null);
  }

  const extraFee = type === 'DOMICILE' ? zones.find((z) => z.cityName === city)?.extraFee ?? 0 : 0;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (date && dayBlocked) {
      setError(
        onVacation && vacation
          ? `Nous sommes en vacances ${formatRange(vacation.start, vacation.end)}. Merci de choisir une date après notre retour.`
          : 'Je ne suis pas disponible ce jour-là. Merci de choisir une autre date.'
      );
      return;
    }
    if (!date || !period || !time) {
      setError('Merci de choisir une date, puis le matin ou l\u2019après-midi.');
      return;
    }
    if (isSlotBlocked(date, periodOfTime(time), blocks)) {
      setError('Ce créneau n\u2019est pas disponible. Merci de choisir un autre moment.');
      return;
    }
    if (findBookingConflict(date, time, booked)) {
      setError(CONFLICT_MESSAGE);
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
        const body = await res.json().catch(() => null);
        setError(body?.message ?? 'Ce créneau n\u2019est plus disponible. Merci de choisir un autre moment.');
      } else {
        setError('Une erreur est survenue, vérifiez les champs ou réessayez dans un instant.');
      }
    } catch {
      setError('Connexion impossible, réessayez dans un instant.');
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
          <p className="text-sm text-orange-800 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
            {onVacation && vacation
              ? `🏖️ Nous sommes en vacances ${formatRange(vacation.start, vacation.end)} (retour le ${formatDayLong(addDays(vacation.end, 1))}). Merci de choisir une date après notre retour.`
              : '⛔ Je ne suis pas disponible ce jour-là (matin et après-midi). Merci de choisir une autre date.'}
          </p>
        )}

        {date && !dayBlocked && (morningBlocked || afternoonBlocked) && (
          <p className="text-sm text-orange-800 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
            ⛔ {morningBlocked ? 'Le matin' : 'L\u2019après-midi'} n&apos;est pas disponible ce jour-là.{' '}
            {morningBlocked ? 'Vous pouvez choisir l\u2019après-midi' : 'Vous pouvez choisir le matin'}, ou une autre date.
          </p>
        )}

        {date && !dayBlocked && (
          <div>
            <p className="block text-sm font-medium mb-1">Moment de la journée</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                aria-disabled={morningBlocked}
                onClick={() => choosePeriod('MORNING')}
                className={`py-2.5 rounded-lg text-sm font-medium border transition ${
                  morningBlocked
                    ? 'bg-gray-100 border-gray-200 text-gray-400 line-through cursor-not-allowed'
                    : period === 'MORNING'
                      ? 'bg-brand text-white border-brand'
                      : 'border-gray-200 text-gray-700'
                }`}
              >
                🌅 Matin{morningBlocked ? ' (indisponible)' : ''}
              </button>
              <button
                type="button"
                aria-disabled={afternoonBlocked}
                onClick={() => choosePeriod('AFTERNOON')}
                className={`py-2.5 rounded-lg text-sm font-medium border transition ${
                  afternoonBlocked
                    ? 'bg-gray-100 border-gray-200 text-gray-400 line-through cursor-not-allowed'
                    : period === 'AFTERNOON'
                      ? 'bg-brand text-white border-brand'
                      : 'border-gray-200 text-gray-700'
                }`}
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
            {conflict ? (
              <p className="text-sm text-orange-800 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 mt-2">
                ⛔ {CONFLICT_MESSAGE}
              </p>
            ) : (
              <p className="text-xs text-gray-500 mt-1">Heure indicative : nous vous confirmons le créneau exact par e-mail ou téléphone.</p>
            )}
            {takenToday.length > 0 && (
              <p className="text-xs text-gray-500 mt-1">Heures déjà réservées ce jour-là : {takenToday.join(', ')}.</p>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

      <button type="submit" disabled={loading} className="w-full bg-brand text-white py-3 rounded-lg font-semibold hover:bg-brand-dark transition disabled:opacity-60">
        {loading ? 'Envoi...' : 'Envoyer la demande'}
      </button>
    </form>
  );
}
