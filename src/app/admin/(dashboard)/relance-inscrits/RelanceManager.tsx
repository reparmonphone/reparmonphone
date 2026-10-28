'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { SUBJECT_VARIANTS } from '@/lib/relanceEmail';
import { previewRelanceEmail, sendRelanceBatch, sendRelanceTest, sendRelanceToOne, type RelanceStats, type RelanceRow } from './actions';

const STATUS_BADGE: Record<RelanceRow['status'], { label: string; cls: string }> = {
  eligible: { label: '⏳ À envoyer', cls: 'bg-green-100 text-green-700' },
  recent: { label: '✅ Déjà envoyé', cls: 'bg-blue-100 text-blue-700' },
  noConsent: { label: 'Sans consentement', cls: 'bg-amber-100 text-amber-700' },
  unsubscribed: { label: 'Désinscrit', cls: 'bg-gray-200 text-gray-600' },
  banned: { label: 'Banni', cls: 'bg-red-100 text-red-700' },
};

function fmt(iso: string | null) {
  return iso ? new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
}

export default function RelanceManager({ stats, rows: initialRows, promos }: { stats: RelanceStats; rows: RelanceRow[]; promos: { code: string; label: string }[] }) {
  const router = useRouter();
  const [code, setCode] = useState(promos.find((p) => /BIENVENUE/i.test(p.code))?.code ?? '');
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [testTo, setTestTo] = useState('contact@reparmonphone.fr');
  const [testName, setTestName] = useState('Krys');
  const [mobile, setMobile] = useState(false);
  const [variant, setVariant] = useState(0);
  const [rows, setRows] = useState(initialRows);
  const [filter, setFilter] = useState<'all' | 'todo' | 'sent' | 'other'>('all');
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [rowMsg, setRowMsg] = useState<string | null>(null);
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [testing, startTest] = useTransition();
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    setPreviewError(null);
    previewRelanceEmail(code || null, variant).then((r) => {
      if (cancelled) return;
      if ('error' in r) {
        setPreview(null);
        setPreviewError(r.error);
      } else setPreview(r);
    });
    return () => {
      cancelled = true;
    };
  }, [code, variant]);

  function sendTest() {
    setTestMsg(null);
    startTest(async () => {
      const r = await sendRelanceTest(code || null, testTo, testName, variant);
      setTestMsg('error' in r ? `❌ ${r.error}` : `✅ E-mail de test envoyé à ${testTo}`);
    });
  }

  async function sendOne(row: RelanceRow) {
    const again = !!row.sentAt;
    const promoText = code ? `avec le code ${code}` : 'sans code promo';
    if (!confirm(`${again ? 'Renvoyer' : 'Envoyer'} la relance à ${row.email} ${promoText} ?${again ? `\n\nElle l'a déjà reçue le ${fmt(row.sentAt)}.` : ''}`)) return;
    setRowBusy(row.email);
    setRowMsg(null);
    const r = await sendRelanceToOne(code || null, row.email, variant);
    setRowBusy(null);
    if ('error' in r) {
      setRowMsg(`❌ ${row.email} : ${r.error}`);
      return;
    }
    setRows((all) => all.map((x) => (x.email === row.email ? { ...x, sentAt: r.sentAt, status: 'recent' } : x)));
    setRowMsg(`✅ Envoyé à ${row.email}`);
  }

  const shownRows = rows.filter((r) =>
    filter === 'all' ? true : filter === 'todo' ? r.status === 'eligible' : filter === 'sent' ? !!r.sentAt : r.status !== 'eligible' && r.status !== 'recent'
  );
  const sentCount = rows.filter((r) => r.sentAt).length;
  const scratchedCount = rows.filter((r) => r.scratchedAt).length;

  async function sendAll() {
    if (stats.eligible === 0) return;
    const promoText = code ? `avec le code ${code}` : 'sans code promo';
    if (!confirm(`Envoyer la relance à ${stats.eligible} personne(s) ${promoText} ?\n\nPense à avoir d'abord envoyé un test et vérifié le rendu.`)) return;
    setRunning(true);
    setLog([]);
    const failed: string[] = [];
    let total = 0;
    for (let i = 0; i < 200; i++) {
      const r = await sendRelanceBatch(code || null, failed, variant);
      if ('error' in r) {
        setLog((l) => [...l, `❌ ${r.error}`]);
        break;
      }
      total += r.sent;
      failed.push(...r.failed);
      setLog((l) => [...l, `✉️ ${total} envoyé(s)${failed.length ? `, ${failed.length} en échec` : ''} — reste ${r.remaining}${r.lastError ? ` (${r.lastError})` : ''}`]);
      if (r.remaining === 0 || (r.sent === 0 && r.failed.length === 0)) break;
      if (r.sent === 0) break; // tout un lot en échec : on s'arrête pour ne pas insister
    }
    setLog((l) => [...l, `✅ Terminé : ${total} e-mail(s) envoyé(s).`]);
    setRunning(false);
    router.refresh();
  }

  const card = (label: string, value: number, tone = 'bg-white', hint?: string) => (
    <div className={`${tone} border border-gray-100 rounded-xl p-4`} title={hint}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {card('Inscrits au total', stats.totalUsers)}
        {card('Ont déjà commandé (exclus)', stats.buyers)}
        {card('Inscrits sans commande', stats.noOrder)}
        {card('À contacter maintenant', stats.eligible, 'bg-green-50')}
        {card('Sans consentement (non contactés)', stats.noConsent, 'bg-amber-50', 'Ils n’ont pas coché la case ni rejoint la newsletter')}
        {card('Désinscrits', stats.unsubscribed)}
        {card('Relancés il y a < 60 jours', stats.alreadySent)}
        {card('Bannis (exclus)', stats.banned)}
      </div>
      {stats.noConsent > 0 && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          {stats.noConsent} inscrit(s) n&apos;ont jamais accepté de recevoir des offres : ils ne sont pas contactés. Ils verront la case « Recevoir les offres » dans « Mon compte », et les nouveaux inscrits la voient dès l&apos;inscription.
        </p>
      )}

      <div className="bg-white border border-gray-100 rounded-xl p-6 space-y-4">
        <h2 className="font-semibold">1. Offre de bienvenue</h2>
        <div className="flex flex-wrap items-center gap-3">
          <select value={code} onChange={(e) => setCode(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
            <option value="">Aucun code promo</option>
            {promos.map((p) => (
              <option key={p.code} value={p.code}>
                {p.code} ({p.label})
              </option>
            ))}
          </select>
          <span className="text-xs text-gray-400">Le code et sa remise s&apos;affichent dans l&apos;e-mail.</span>
        </div>
        {previewError && <p className="text-sm text-red-600">{previewError}</p>}
        {code ? (
          <p className="text-xs text-gray-500">
            🎟️ Avec un code promo, l&apos;e-mail contient un <strong>ticket à gratter</strong> : le client clique, gratte sur une page dédiée et découvre son code. Tous les tickets sont gagnants (même offre pour tous).
          </p>
        ) : (
          <p className="text-xs text-amber-700">Sans code promo, c&apos;est l&apos;e-mail simple (pas de ticket à gratter) qui est envoyé.</p>
        )}
        <div>
          <label className="block text-sm font-medium mb-1">Objet de l&apos;e-mail (avec emoji)</label>
          <select value={variant} onChange={(e) => setVariant(Number(e.target.value))} className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full max-w-lg">
            {SUBJECT_VARIANTS.map((v, i) => (
              <option key={i} value={i}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl p-6 space-y-3">
        <h2 className="font-semibold">2. Aperçu</h2>
        {preview ? (
          <>
            <p className="text-sm text-gray-600">
              <span className="text-gray-400">Objet :</span> <strong>{preview.subject}</strong>
            </p>
            <div className="flex gap-2 text-xs">
              <button type="button" onClick={() => setMobile(false)} className={`px-3 py-1 rounded-full border ${!mobile ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-200 text-gray-600'}`}>
                🖥️ Ordinateur
              </button>
              <button type="button" onClick={() => setMobile(true)} className={`px-3 py-1 rounded-full border ${mobile ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-200 text-gray-600'}`}>
                📱 Téléphone
              </button>
            </div>
            <iframe
              title="Aperçu de l'e-mail"
              srcDoc={preview.html}
              style={{ width: mobile ? 375 : '100%', maxWidth: '100%' }}
              className="h-[720px] border border-gray-200 rounded-lg bg-gray-100 mx-auto block"
            />
          </>
        ) : (
          !previewError && <p className="text-sm text-gray-400">Chargement de l&apos;aperçu…</p>
        )}
      </div>

      <div className="bg-white border border-gray-100 rounded-xl p-6 space-y-3">
        <h2 className="font-semibold">3. Envoyer un test (rendu réel dans ta boîte mail)</h2>
        <p className="text-xs text-gray-500">
          Reçois exactement l&apos;e-mail que verront les inscrits (objet précédé de « [TEST] »), pour le vérifier dans Gmail, Outlook ou sur ton téléphone. Le lien de désinscription du test est valide : il te désinscrirait vraiment, évite de cliquer dessus avec ton adresse.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <input value={testName} onChange={(e) => setTestName(e.target.value)} placeholder="Prénom" className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-32" />
          <input value={testTo} onChange={(e) => setTestTo(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-72" />
          <button type="button" onClick={sendTest} disabled={testing} className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 disabled:opacity-60">
            {testing ? 'Envoi…' : 'Envoyer le test'}
          </button>
          {testMsg && <span className="text-sm">{testMsg}</span>}
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl p-6 space-y-3">
        <h2 className="font-semibold">Suivi des inscrits sans commande</h2>
        <p className="text-xs text-gray-500">
          {sentCount} inscrit(s) ont déjà reçu la relance, dont {scratchedCount} ont gratté leur ticket. Une ligne « ✅ Déjà envoyé » ne reçoit plus rien pendant 60 jours avec l&apos;envoi groupé ; tu peux la renvoyer à la main avec le bouton.
        </p>
        <div className="flex flex-wrap gap-2 text-xs">
          {([
            ['all', `Tous (${rows.length})`],
            ['todo', `À envoyer (${rows.filter((r) => r.status === 'eligible').length})`],
            ['sent', `Déjà envoyé (${sentCount})`],
            ['other', `Non contactables (${rows.filter((r) => r.status !== 'eligible' && r.status !== 'recent').length})`],
          ] as const).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setFilter(k)} className={`px-3 py-1 rounded-full border ${filter === k ? 'bg-brand text-white border-brand' : 'border-gray-200 text-gray-600'}`}>
              {l}
            </button>
          ))}
        </div>
        {rowMsg && <p className="text-sm">{rowMsg}</p>}
        <div className="overflow-x-auto max-h-[480px] overflow-y-auto border border-gray-100 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left sticky top-0">
              <tr>
                <th className="px-3 py-2">Inscrit</th>
                <th className="px-3 py-2">Inscrit le</th>
                <th className="px-3 py-2">État</th>
                <th className="px-3 py-2">Dernier envoi</th>
                <th className="px-3 py-2">Ticket</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {shownRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-gray-400">Aucun inscrit dans cette liste.</td>
                </tr>
              )}
              {shownRows.map((r) => {
                const b = STATUS_BADGE[r.status];
                const canSend = r.status === 'eligible' || r.status === 'recent';
                return (
                  <tr key={r.email}>
                    <td className="px-3 py-2">
                      <div className="font-medium text-gray-800">{r.name || '—'}</div>
                      <div className="text-xs text-gray-500">{r.email}</div>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{fmt(r.createdAt)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${b.cls}`}>{b.label}</span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{fmt(r.sentAt)}</td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">
                      {r.scratchedAt ? <span className="text-green-700 font-medium" title={fmt(r.scratchedAt)}>🎟️ Gratté le {fmt(r.scratchedAt)}</span> : r.sentAt ? <span className="text-gray-400">Pas encore gratté</span> : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {canSend && (
                        <button type="button" onClick={() => sendOne(r)} disabled={rowBusy === r.email || running} className="text-brand text-xs font-medium hover:underline disabled:opacity-50">
                          {rowBusy === r.email ? '…' : r.sentAt ? 'Renvoyer' : 'Envoyer'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl p-6 space-y-3">
        <h2 className="font-semibold">4. Envoyer aux inscrits</h2>
        <p className="text-sm text-gray-500">
          {stats.eligible} personne(s) recevront l&apos;e-mail, par lots de 10. Garde cette page ouverte jusqu&apos;à la fin.
        </p>
        <button
          type="button"
          onClick={sendAll}
          disabled={running || stats.eligible === 0}
          className="bg-brand text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-brand-dark transition disabled:opacity-50"
        >
          {running ? 'Envoi en cours…' : `📣 Envoyer à ${stats.eligible} inscrit(s)`}
        </button>
        {log.length > 0 && (
          <ul className="text-xs text-gray-600 space-y-0.5 max-h-40 overflow-auto">
            {log.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
