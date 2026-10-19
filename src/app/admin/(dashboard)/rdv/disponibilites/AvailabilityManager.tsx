'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addBlocks, deleteBlock, setSlotOpen } from './actions';
import { PERIOD_LABELS, WEEKDAY_LABELS, addDays, weekdayOfDate, type RdvPeriodKey } from '@/lib/rdvAvailability';

type Block = { id: string; date: string | null; weekday: number | null; period: RdvPeriodKey; note: string | null };

const DAYS_SHOWN = 28;

function formatDate(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

export default function AvailabilityManager({ today, blocks }: { today: string; blocks: Block[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  // Formulaire « fermer plusieurs jours / chaque semaine »
  const [mode, setMode] = useState<'dates' | 'weekly'>('dates');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [weekday, setWeekday] = useState(1);
  const [period, setPeriod] = useState<RdvPeriodKey>('DAY');
  const [note, setNote] = useState('');

  const dateBlocks = blocks.filter((b) => b.date);
  const weeklyBlocks = blocks.filter((b) => !b.date);

  function blockFor(date: string, slot: 'MORNING' | 'AFTERNOON') {
    const dateBlock = dateBlocks.find((b) => b.date === date && (b.period === 'DAY' || b.period === slot));
    if (dateBlock) return { kind: 'date' as const, block: dateBlock };
    const wd = weekdayOfDate(date);
    const weekly = weeklyBlocks.find((b) => b.weekday === wd && (b.period === 'DAY' || b.period === slot));
    if (weekly) return { kind: 'weekly' as const, block: weekly };
    return null;
  }

  function run(fn: () => Promise<{ error?: string; ok?: boolean; created?: number } | undefined>, okMessage?: string) {
    setMessage(null);
    startTransition(async () => {
      const res = await fn();
      if (res?.error) setMessage(`⚠️ ${res.error}`);
      else if (okMessage) setMessage(okMessage);
      router.refresh();
    });
  }

  const days = Array.from({ length: DAYS_SHOWN }, (_, i) => addDays(today, i));

  const card = 'bg-white border border-gray-100 rounded-xl p-5 mb-6';
  const input = 'border border-gray-200 rounded-lg px-3 py-2 text-sm';

  return (
    <div className="max-w-4xl">
      <p className="text-sm text-gray-600 mb-6">
        Ici tu choisis quand les clients peuvent demander un rendez-vous. Un créneau <strong>fermé</strong> est grisé et
        impossible à choisir sur la page publique « Prendre rendez-vous » (et refusé même si quelqu&apos;un insiste). Tout
        est ouvert par défaut.
      </p>

      {message && <p className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 mb-4">{message}</p>}

      {/* ---- Interrupteurs rapides ---- */}
      <div className={card}>
        <h2 className="font-semibold mb-1">Les 4 prochaines semaines</h2>
        <p className="text-xs text-gray-500 mb-4">
          Clique sur un créneau pour le fermer 🔴 ou le rouvrir 🟢. 🔁 = fermé chaque semaine (à retirer dans la liste plus bas).
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {days.map((date) => (
            <div key={date} className="border border-gray-100 rounded-lg p-2">
              <p className="text-xs font-semibold text-gray-700 mb-1.5 capitalize">{formatDate(date)}</p>
              {(['MORNING', 'AFTERNOON'] as const).map((slot) => {
                const b = blockFor(date, slot);
                const label = slot === 'MORNING' ? 'Matin' : 'Après-midi';
                if (b?.kind === 'weekly') {
                  return (
                    <div key={slot} className="text-[11px] rounded px-2 py-1 mb-1 bg-gray-100 text-gray-500 text-center">
                      🔁 {label}
                    </div>
                  );
                }
                const closed = !!b;
                return (
                  <button
                    key={slot}
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => setSlotOpen(date, slot, closed))}
                    className={`w-full text-[11px] rounded px-2 py-1 mb-1 border transition disabled:opacity-50 ${
                      closed
                        ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                        : 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
                    }`}
                  >
                    {closed ? '🔴' : '🟢'} {label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* ---- Fermer plusieurs jours / chaque semaine ---- */}
      <div className={card}>
        <h2 className="font-semibold mb-3">Fermer plusieurs jours ou chaque semaine</h2>
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setMode('dates')}
            className={`px-3 py-1.5 text-sm rounded-lg border ${mode === 'dates' ? 'bg-brand text-white border-brand' : 'border-gray-200 text-gray-600'}`}
          >
            Un jour ou une période
          </button>
          <button
            type="button"
            onClick={() => setMode('weekly')}
            className={`px-3 py-1.5 text-sm rounded-lg border ${mode === 'weekly' ? 'bg-brand text-white border-brand' : 'border-gray-200 text-gray-600'}`}
          >
            Chaque semaine
          </button>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          {mode === 'dates' ? (
            <>
              <label className="text-xs text-gray-500">
                Du
                <input type="date" min={today} value={from} onChange={(e) => setFrom(e.target.value)} className={`${input} block mt-1`} />
              </label>
              <label className="text-xs text-gray-500">
                Au (facultatif)
                <input type="date" min={from || today} value={to} onChange={(e) => setTo(e.target.value)} className={`${input} block mt-1`} />
              </label>
            </>
          ) : (
            <label className="text-xs text-gray-500">
              Tous les
              <select value={weekday} onChange={(e) => setWeekday(Number(e.target.value))} className={`${input} block mt-1`}>
                {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                  <option key={d} value={d}>{WEEKDAY_LABELS[d]}s</option>
                ))}
              </select>
            </label>
          )}
          <label className="text-xs text-gray-500">
            Créneau fermé
            <select value={period} onChange={(e) => setPeriod(e.target.value as RdvPeriodKey)} className={`${input} block mt-1`}>
              <option value="DAY">{PERIOD_LABELS.DAY}</option>
              <option value="MORNING">{PERIOD_LABELS.MORNING}</option>
              <option value="AFTERNOON">{PERIOD_LABELS.AFTERNOON}</option>
            </select>
          </label>
          <label className="text-xs text-gray-500 flex-1 min-w-[160px]">
            Mémo perso (facultatif)
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} placeholder="ex : vacances" className={`${input} block mt-1 w-full`} />
          </label>
          <button
            type="button"
            disabled={pending || (mode === 'dates' && !from)}
            onClick={() =>
              run(
                () => addBlocks({ mode, from, to, weekday, period, note }),
                '✅ Créneaux fermés. Ils sont déjà grisés sur la page publique.'
              )
            }
            className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-dark transition disabled:opacity-50"
          >
            Fermer
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">Le mémo n&apos;est jamais visible par les clients.</p>
      </div>

      {/* ---- Listes ---- */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className={card}>
          <h2 className="font-semibold mb-3">Fermetures à venir ({dateBlocks.length})</h2>
          {dateBlocks.length === 0 ? (
            <p className="text-sm text-gray-400">Aucune : tous les créneaux sont ouverts.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {dateBlocks.map((b) => (
                <li key={b.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                  <span>
                    <span className="capitalize">{formatDate(b.date as string)}</span> — {PERIOD_LABELS[b.period]}
                    {b.note && <span className="text-gray-400"> · {b.note}</span>}
                  </span>
                  <button type="button" disabled={pending} onClick={() => run(() => deleteBlock(b.id))} className="text-xs text-green-700 hover:underline whitespace-nowrap">
                    Rouvrir
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={card}>
          <h2 className="font-semibold mb-3">Fermées chaque semaine ({weeklyBlocks.length})</h2>
          {weeklyBlocks.length === 0 ? (
            <p className="text-sm text-gray-400">Aucune.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {weeklyBlocks.map((b) => (
                <li key={b.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                  <span>
                    Tous les {WEEKDAY_LABELS[b.weekday ?? 0].toLowerCase()}s — {PERIOD_LABELS[b.period]}
                    {b.note && <span className="text-gray-400"> · {b.note}</span>}
                  </span>
                  <button type="button" disabled={pending} onClick={() => run(() => deleteBlock(b.id))} className="text-xs text-green-700 hover:underline whitespace-nowrap">
                    Rouvrir
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
