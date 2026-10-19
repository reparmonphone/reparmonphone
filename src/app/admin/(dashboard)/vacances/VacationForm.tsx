'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveVacation } from './actions';
import VacationPopupView, { VacationCard } from '@/components/VacationPopupView';
import {
  DEFAULT_VACATION,
  buildVacationPayload,
  isValidRange,
  type VacationConfig,
  type VacationPayload,
} from '@/lib/vacationShared';
import { addDays } from '@/lib/rdvAvailability';

function dayNumber(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

export default function VacationForm({ initial, today }: { initial: VacationConfig; today: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [c, setC] = useState<VacationConfig>(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<VacationPayload | null>(null);
  const [replay, setReplay] = useState(0);
  const [livePhase, setLivePhase] = useState<'during' | 'before'>('during');

  const set = <K extends keyof VacationConfig>(key: K, value: VacationConfig[K]) => setC((prev) => ({ ...prev, [key]: value }));

  // Aperçu : utilise les valeurs ACTUELLES du formulaire (même non enregistrées). Sans dates valides, on prend des
  // dates d'exemple. L'aperçu choisit un jour « au milieu » des vacances pour que la batterie soit parlante.
  function makePayload(phase: 'during' | 'before'): VacationPayload {
    let cfg = c;
    if (!isValidRange(c.start, c.end)) {
      cfg = { ...c, start: addDays(today, phase === 'during' ? -4 : 9), end: addDays(today, phase === 'during' ? 9 : 23) };
    }
    let previewToday = today;
    if (phase === 'during') {
      const total = dayNumber(cfg.end) - dayNumber(cfg.start) + 1;
      const inside = today >= cfg.start && today <= cfg.end;
      if (!inside) previewToday = addDays(cfg.start, Math.floor(total / 2));
    } else {
      previewToday = addDays(cfg.start, -Math.min(Math.max(c.announceDays, 1), 5));
    }
    return buildVacationPayload(cfg, phase, previewToday);
  }

  function openPreview(phase: 'during' | 'before') {
    setPreview(makePayload(phase));
  }

  // Aperçu en direct (colonne de droite) : se met à jour à chaque frappe
  const livePayload = useMemo(
    () => makePayload(livePhase === 'before' && c.announceDays > 0 ? 'before' : 'during'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [c, livePhase, today]
  );

  function save() {
    setMessage(null);
    startTransition(async () => {
      const res = await saveVacation(c);
      setMessage(res.error ? `⚠️ ${res.error}` : c.enabled ? '✅ Enregistré. Le pop-up s’affichera automatiquement aux dates choisies (comptez 1 minute pour la mise à jour).' : '✅ Enregistré (mode vacances désactivé : rien n’est visible par les visiteurs).');
      router.refresh();
    });
  }

  const card = 'bg-white border border-gray-100 rounded-xl p-5 mb-6';
  const input = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm';
  const label = 'block text-xs font-medium text-gray-500 mb-1';

  return (
    <div className="grid items-start gap-6 2xl:grid-cols-[minmax(0,1fr)_600px]">
      <div className="min-w-0 max-w-3xl">
      {message && <p className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 mb-4">{message}</p>}

      <div className={card}>
        <h2 className="font-semibold mb-3">1. Activation</h2>
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" checked={c.enabled} onChange={(e) => set('enabled', e.target.checked)} className="mt-1 h-4 w-4 accent-brand" />
          <span>
            <span className="text-sm font-medium text-gray-800">Activer le mode vacances</span>
            <span className="block text-xs text-gray-500 mt-0.5">
              Coché, le pop-up s&apos;affiche automatiquement pendant les dates ci-dessous (et pendant le préavis éventuel). Décoché, les visiteurs ne voient jamais rien, même si des dates sont renseignées. Les rendez-vous sont aussi fermés pendant les vacances.
            </span>
          </span>
        </label>
      </div>

      <div className={card}>
        <h2 className="font-semibold mb-3">2. Dates</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className={label}>Premier jour de vacances</label>
            <input type="date" value={c.start} onChange={(e) => set('start', e.target.value)} className={input} />
          </div>
          <div>
            <label className={label}>Dernier jour de vacances (inclus)</label>
            <input type="date" min={c.start || undefined} value={c.end} onChange={(e) => set('end', e.target.value)} className={input} />
          </div>
          <div>
            <label className={label}>Prévenir les visiteurs avant le départ</label>
            <select value={c.announceDays} onChange={(e) => set('announceDays', Number(e.target.value))} className={input}>
              <option value={0}>Non, seulement pendant les vacances</option>
              <option value={3}>3 jours avant</option>
              <option value={7}>7 jours avant</option>
              <option value={14}>14 jours avant</option>
            </select>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          Le retour affiché est le lendemain du dernier jour de vacances.
        </p>
      </div>

      <div className={card}>
        <h2 className="font-semibold mb-3">3. Textes</h2>
        <div className="space-y-4">
          <div>
            <label className={label}>Titre pendant les vacances</label>
            <input value={c.title} maxLength={80} onChange={(e) => set('title', e.target.value)} className={input} />
          </div>
          <div>
            <label className={label}>Message pendant les vacances (la touche d&apos;humour)</label>
            <textarea value={c.message} maxLength={400} rows={3} onChange={(e) => set('message', e.target.value)} className={input} />
          </div>
          <div>
            <label className={label}>Titre avant le départ (préavis)</label>
            <input value={c.titleBefore} maxLength={80} onChange={(e) => set('titleBefore', e.target.value)} className={input} />
          </div>
          <div>
            <label className={label}>Message avant le départ (préavis)</label>
            <textarea value={c.messageBefore} maxLength={400} rows={3} onChange={(e) => set('messageBefore', e.target.value)} className={input} />
          </div>
          <div>
            <label className={label}>Titre du bloc vert « commandes » (bien visible)</label>
            <input value={c.orderTitle} maxLength={90} onChange={(e) => set('orderTitle', e.target.value)} className={input} />
          </div>
          <div>
            <label className={label}>Précision sur les commandes (à adapter à la réalité !)</label>
            <textarea value={c.orderInfo} maxLength={300} rows={2} onChange={(e) => set('orderInfo', e.target.value)} className={input} />
            <p className="text-xs text-amber-700 mt-1">
              Vérifie que cette phrase correspond à ce que tu vas vraiment faire : expédier à ton retour, ou pendant tes vacances.
            </p>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={c.showContact} onChange={(e) => set('showContact', e.target.checked)} className="h-4 w-4 accent-brand" />
            <span className="text-sm text-gray-700">Afficher l&apos;adresse e-mail de contact dans le pop-up</span>
          </label>
          <button
            type="button"
            onClick={() => setC((p) => ({ ...p, title: DEFAULT_VACATION.title, message: DEFAULT_VACATION.message, titleBefore: DEFAULT_VACATION.titleBefore, messageBefore: DEFAULT_VACATION.messageBefore, orderTitle: DEFAULT_VACATION.orderTitle, orderInfo: DEFAULT_VACATION.orderInfo }))}
            className="text-xs text-gray-500 hover:text-gray-800 underline"
          >
            Remettre les textes d&apos;origine
          </button>
        </div>
      </div>

      <div className={card}>
        <h2 className="font-semibold mb-1">4. Visuel du haut (photo ou vidéo)</h2>
        <p className="text-xs text-gray-500 mb-3">
          Par défaut, une animation intégrée (mer, soleil, palmier) s&apos;affiche. Pour mettre ta propre <strong>vidéo</strong> (.mp4, .webm) ou <strong>photo</strong> (.jpg, .png, .webp) :
          copie le fichier dans le dossier <code className="bg-gray-100 px-1 rounded">public\vacances</code> du projet, puis écris ci-dessous son chemin, par exemple <code className="bg-gray-100 px-1 rounded">/vacances/plage.mp4</code>.
          Si le fichier n&apos;existe pas (ou ne se charge pas), l&apos;animation intégrée prend automatiquement le relais.
        </p>
        <label className={label}>Chemin du fichier (facultatif)</label>
        <input value={c.mediaUrl} maxLength={300} placeholder="/vacances/plage.mp4" onChange={(e) => set('mediaUrl', e.target.value)} className={input} />
        <p className="text-xs text-gray-400 mt-2">
          Conseil : une vidéo courte (8 à 15 secondes, sans son, moins de 4 Mo) qui boucle. Utilise des images dont tu as les droits (banques gratuites comme Pexels ou Pixabay : vérifie la licence).
        </p>
      </div>

      <div className={card}>
        <h2 className="font-semibold mb-1">5. Aperçu en plein écran</h2>
        <p className="text-xs text-gray-500 mb-4">
          Ouvre le pop-up tel que les visiteurs le verront, avec les valeurs ci-dessus (même non enregistrées). Rien n&apos;est publié : personne d&apos;autre que toi ne le voit.
        </p>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => openPreview('during')} className="px-4 py-2 rounded-lg text-sm font-semibold bg-gray-800 text-white hover:bg-gray-700 transition">
            👁️ Voir le pop-up « pendant les vacances »
          </button>
          <button type="button" onClick={() => openPreview('before')} disabled={c.announceDays === 0} className="px-4 py-2 rounded-lg text-sm font-semibold bg-gray-600 text-white hover:bg-gray-500 transition disabled:opacity-40" title={c.announceDays === 0 ? 'Choisis un préavis dans les dates pour voir ce pop-up' : undefined}>
            👁️ Voir le pop-up « avant le départ »
          </button>
        </div>
      </div>

      <div>
        <button type="button" disabled={pending} onClick={save} className="px-6 py-3 rounded-xl text-sm font-bold bg-brand text-white hover:bg-brand-dark transition disabled:opacity-50">
          {pending ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>

      </div>

      <aside className="order-first 2xl:order-none 2xl:sticky 2xl:top-4">
        <div className="rounded-2xl border border-gray-200 bg-slate-100 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-800">👁️ Aperçu en direct (privé)</h2>
            <div className="flex items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setLivePhase('during')}
                className={`rounded-lg px-2.5 py-1 font-medium transition ${livePhase === 'during' ? 'bg-gray-800 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
              >
                Pendant
              </button>
              <button
                type="button"
                disabled={c.announceDays === 0}
                onClick={() => setLivePhase('before')}
                title={c.announceDays === 0 ? 'Choisis un préavis dans les dates pour voir ce pop-up' : undefined}
                className={`rounded-lg px-2.5 py-1 font-medium transition disabled:opacity-40 ${livePhase === 'before' && c.announceDays > 0 ? 'bg-gray-800 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
              >
                Avant le départ
              </button>
              <button type="button" onClick={() => setReplay((n) => n + 1)} className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 font-medium text-gray-600 hover:bg-gray-50">
                ↻ Rejouer
              </button>
            </div>
          </div>
          <VacationCard key={replay} data={livePayload} inline preview />
          <p className="mt-3 text-[11px] leading-snug text-gray-500">
            Ce que tu vois ici est exactement ce que verront les visiteurs. Il se met à jour pendant que tu écris. Rien n&apos;est visible du public tant que « Activer le mode vacances » n&apos;est pas coché <strong>et</strong> enregistré.
          </p>
        </div>
      </aside>

      {preview && <VacationPopupView data={preview} preview onClose={() => setPreview(null)} />}
    </div>
  );
}
