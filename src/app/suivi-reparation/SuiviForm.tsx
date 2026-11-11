'use client';

import { useState } from 'react';
import MailInRepairStepper from '@/components/MailInRepairStepper';
import { lookupRepairs, type RepairStatusResult } from './actions';

const APPT_STEPS = [
  { key: 'REQUESTED', label: 'Demande reçue', icon: '📝' },
  { key: 'CONFIRMED', label: 'Rendez-vous confirmé', icon: '📅' },
  { key: 'DONE', label: 'Réparation terminée', icon: '✅' },
];

const KIND_LABEL: Record<RepairStatusResult['kind'], string> = {
  ATELIER: 'Réparation en atelier',
  DOMICILE: 'Réparation à domicile',
  CORRESPONDANCE: 'Réparation par correspondance',
};

function AppointmentSteps({ status }: { status: string }) {
  const current = APPT_STEPS.findIndex((s) => s.key === status);
  return (
    <ol className="flex items-start">
      {APPT_STEPS.map((s, i) => {
        const state = i < current ? 'done' : i === current ? 'current' : 'upcoming';
        return (
          <li key={s.key} className="flex flex-1 flex-col items-center text-center">
            <div className="flex w-full items-center">
              <div className={`h-0.5 flex-1 ${i === 0 ? 'invisible' : state === 'upcoming' ? 'bg-gray-200' : 'bg-brand'}`} />
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm ${
                  state === 'upcoming'
                    ? 'border-gray-200 bg-white text-gray-300'
                    : state === 'current'
                    ? 'border-brand bg-brand text-white ring-4 ring-brand-light'
                    : 'border-brand bg-brand text-white'
                }`}
              >
                {s.icon}
              </div>
              <div
                className={`h-0.5 flex-1 ${i === APPT_STEPS.length - 1 ? 'invisible' : state === 'done' ? 'bg-brand' : 'bg-gray-200'}`}
              />
            </div>
            <span className={`mt-2 px-1 text-xs ${state === 'upcoming' ? 'text-gray-400' : 'font-semibold text-gray-800'}`}>
              {s.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export default function SuiviForm() {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [results, setResults] = useState<RepairStatusResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResults(null);
    setPending(true);
    try {
      const res = await lookupRepairs(email, phone);
      if (res.ok) setResults(res.results);
      else setError(res.error);
    } catch {
      setError('Connexion impossible, réessayez dans un instant.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <form onSubmit={submit} className="space-y-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Votre e-mail (celui de la demande)"
          autoComplete="email"
          className="w-full rounded-lg border border-gray-200 px-3 py-2.5"
        />
        <input
          type="tel"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Votre téléphone (celui de la demande)"
          autoComplete="tel"
          className="w-full rounded-lg border border-gray-200 px-3 py-2.5"
        />
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-brand py-3 font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
        >
          {pending ? 'Recherche…' : 'Voir l’avancement de ma réparation'}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>

      {results && results.length === 0 && (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Aucune demande trouvée avec cet e-mail et ce numéro. Vérifiez qu’ils sont identiques à ceux saisis lors de votre
          demande, ou appelez-nous au{' '}
          <a href="tel:+33783497262" className="underline">
            07 83 49 72 62
          </a>
          .
        </div>
      )}

      {results && results.length > 0 && (
        <div className="mt-6 space-y-4">
          {results.map((r) => (
            <article key={`${r.kind}-${r.id}`} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <header className="mb-4">
                <h2 className="font-bold text-gray-900">{r.device}</h2>
                <p className="text-xs text-gray-500">
                  {KIND_LABEL[r.kind]} · {new Date(r.date).toLocaleDateString('fr-FR')}
                </p>
              </header>
              {r.status === 'CANCELLED' ? (
                <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  Cette demande a été annulée. Une question ? Appelez-nous au{' '}
                  <a href="tel:+33783497262" className="underline">
                    07 83 49 72 62
                  </a>
                  .
                </p>
              ) : r.kind === 'CORRESPONDANCE' ? (
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                <MailInRepairStepper status={r.status as any} />
              ) : (
                <AppointmentSteps status={r.status} />
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
