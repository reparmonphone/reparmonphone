'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  deleteProposal,
  saveProposal,
  searchProductsForProposal,
  sendProposalEmail,
  type ProductHit,
} from './actions';
import { isExpired, itemsTotal, laborTotal, proposalTotal, type Proposal } from '@/lib/proposalShared';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.reparmonphone.fr';
const eur = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);
const dateFr = (ymd: string) => (ymd ? `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}/${ymd.slice(0, 4)}` : '');
const dateTimeFr = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

type Line = { productId: string; title: string; price: number; quantity: number };
type LaborLine = { label: string; price: string };
type Notice = { kind: 'ok' | 'error'; text: string; token?: string } | null;

const input = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';

export default function ProposalManager({ proposals, today }: { proposals: Proposal[]; today: string }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null); // proposition en cours de modification
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [validDays, setValidDays] = useState(14);
  const [lines, setLines] = useState<Line[]>([]);
  const [labor, setLabor] = useState<LaborLine[]>([]);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<ProductHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const reqId = useRef(0);

  // Recherche de produit (déclenchée 300 ms après la dernière frappe)
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    const id = ++reqId.current;
    const t = window.setTimeout(() => {
      setSearching(true);
      searchProductsForProposal(q)
        .then((r) => id === reqId.current && setHits(r))
        .catch(() => id === reqId.current && setHits([]))
        .finally(() => id === reqId.current && setSearching(false));
    }, 300);
    return () => window.clearTimeout(t);
  }, [query]);

  const parsedLabor = labor
    .map((l) => ({ label: l.label.trim(), price: Number(l.price.replace(',', '.')) }))
    .filter((l) => l.label && Number.isFinite(l.price) && l.price >= 0);
  const partsSum = itemsTotal(lines);
  const laborSum = laborTotal(parsedLabor);

  const reset = () => {
    setToken(null);
    setName('');
    setEmail('');
    setMessage('');
    setValidDays(14);
    setLines([]);
    setLabor([]);
    setQuery('');
    setHits([]);
  };

  const addProduct = (h: ProductHit) => {
    if (!h.inStock) return;
    setLines((cur) => {
      const found = cur.find((l) => l.productId === h.id);
      if (found) return cur.map((l) => (l.productId === h.id ? { ...l, quantity: Math.min(99, l.quantity + 1) } : l));
      return [...cur, { productId: h.id, title: h.title, price: h.price, quantity: 1 }];
    });
  };

  const payload = () => ({
    token: token ?? undefined,
    customerName: name,
    customerEmail: email,
    message,
    validDays,
    items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
    labor: labor.map((l) => ({ label: l.label, price: l.price })),
  });

  const submit = async (andSend: boolean) => {
    setNotice(null);
    if (andSend && !email.trim()) {
      setNotice({ kind: 'error', text: 'Pour envoyer par e-mail, renseigne l’adresse du client.' });
      return;
    }
    setBusy(true);
    try {
      const saved = await saveProposal(payload());
      if ('error' in saved) {
        setNotice({ kind: 'error', text: saved.error ?? 'Erreur.' });
        return;
      }
      const tk = saved.proposal.token;
      setToken(tk);
      if (andSend) {
        const sent = await sendProposalEmail(tk);
        if ('error' in sent) {
          setNotice({ kind: 'error', text: `Proposition enregistrée, mais ${sent.error}`, token: tk });
        } else {
          setNotice({ kind: 'ok', text: `Proposition enregistrée et envoyée à ${saved.proposal.customerEmail}.`, token: tk });
        }
      } else {
        setNotice({ kind: 'ok', text: 'Proposition enregistrée. Le lien est prêt à être copié.', token: tk });
      }
      router.refresh();
    } catch {
      setNotice({ kind: 'error', text: 'Une erreur est survenue, réessaie.' });
    } finally {
      setBusy(false);
    }
  };

  const edit = (p: Proposal) => {
    setToken(p.token);
    setName(p.customerName);
    setEmail(p.customerEmail);
    setMessage(p.message);
    setValidDays(14);
    setLines(p.items.map((i) => ({ productId: i.productId, title: i.title, price: i.price, quantity: i.quantity })));
    setLabor(p.labor.map((l) => ({ label: l.label, price: String(l.price).replace('.', ',') })));
    setNotice(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const copy = async (tk: string) => {
    try {
      await navigator.clipboard.writeText(`${SITE_URL}/proposition/${tk}`);
      setNotice({ kind: 'ok', text: 'Lien copié : tu peux le coller dans un message ou un SMS.' });
    } catch {
      setNotice({ kind: 'error', text: `Copie impossible. Lien : ${SITE_URL}/proposition/${tk}` });
    }
  };

  const resend = async (p: Proposal) => {
    setBusy(true);
    setNotice(null);
    try {
      const r = await sendProposalEmail(p.token);
      setNotice('error' in r ? { kind: 'error', text: r.error ?? 'Erreur.' } : { kind: 'ok', text: `E-mail envoyé à ${p.customerEmail}.` });
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (p: Proposal) => {
    if (!window.confirm('Supprimer cette proposition ? Le lien envoyé au client ne fonctionnera plus.')) return;
    setBusy(true);
    try {
      await deleteProposal(p.token);
      if (token === p.token) reset();
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="space-y-5 rounded-xl border border-gray-100 bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">{token ? 'Modifier la proposition' : 'Nouvelle proposition'}</h2>
          {(token || lines.length > 0 || labor.length > 0 || name || email) && (
            <button type="button" onClick={() => { reset(); setNotice(null); }} className="text-xs text-gray-500 underline hover:text-gray-700">
              Tout effacer / nouvelle proposition
            </button>
          )}
        </div>

        {/* Client */}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-gray-600">Nom du client</span>
            <input className={input} value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder="Clément Martin" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-gray-600">E-mail du client</span>
            <input className={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} placeholder="client@exemple.fr" />
          </label>
        </div>

        {/* Produits */}
        <div>
          <span className="mb-1 block text-sm text-gray-600">Produits</span>
          <input className={input} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Chercher un produit : « iphone 13 écran », « batterie a52 »…" />
          {query.trim().length >= 2 && (
            <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-gray-100">
              {searching && hits.length === 0 && <p className="p-3 text-sm text-gray-500">Recherche…</p>}
              {!searching && hits.length === 0 && <p className="p-3 text-sm text-gray-500">Aucun produit trouvé.</p>}
              {hits.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  disabled={!h.inStock}
                  onClick={() => addProduct(h)}
                  className="flex w-full items-center justify-between gap-3 border-b border-gray-50 px-3 py-2 text-left text-sm last:border-0 hover:bg-brand-light/40 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="min-w-0 flex-1 truncate">{h.title}</span>
                  <span className="shrink-0 text-gray-500">{h.inStock ? eur(h.price) : 'Rupture'}</span>
                  {h.inStock && <span className="shrink-0 font-semibold text-brand">+ Ajouter</span>}
                </button>
              ))}
            </div>
          )}

          {lines.length > 0 && (
            <div className="mt-3 divide-y divide-gray-100 rounded-lg border border-gray-100">
              {lines.map((l) => (
                <div key={l.productId} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 basis-60">{l.title}</span>
                  <span className="text-gray-500">{eur(l.price)}</span>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={l.quantity}
                    onChange={(e) => {
                      const q = Math.max(1, Math.min(99, Math.round(Number(e.target.value) || 1)));
                      setLines((cur) => cur.map((x) => (x.productId === l.productId ? { ...x, quantity: q } : x)));
                    }}
                    className="w-16 rounded-lg border border-gray-200 px-2 py-1 text-center"
                    aria-label={`Quantité de ${l.title}`}
                  />
                  <span className="w-20 text-right font-medium tabular-nums">{eur(l.price * l.quantity)}</span>
                  <button type="button" onClick={() => setLines((cur) => cur.filter((x) => x.productId !== l.productId))} className="text-gray-400 hover:text-red-600" aria-label="Retirer">
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Main d'œuvre */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={labor.length > 0}
              onChange={(e) => setLabor(e.target.checked ? [{ label: '', price: '' }] : [])}
            />
            Avec main d’œuvre
          </label>
          {labor.length > 0 && (
            <div className="mt-2 space-y-2">
              {labor.map((l, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <input
                    className={`${input} flex-1 basis-60`}
                    value={l.label}
                    maxLength={120}
                    onChange={(e) => setLabor((cur) => cur.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                    placeholder="Ex. Remplacement de l’écran, pose en atelier"
                  />
                  <div className="flex items-center gap-1">
                    <input
                      className={`${input} w-28 text-right`}
                      inputMode="decimal"
                      value={l.price}
                      onChange={(e) => setLabor((cur) => cur.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))}
                      placeholder="39,00"
                    />
                    <span className="text-sm text-gray-500">€</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLabor((cur) => (cur.length === 1 ? [] : cur.filter((_, j) => j !== i)))}
                    className="text-gray-400 hover:text-red-600"
                    aria-label="Retirer la ligne"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {labor.length < 10 && (
                <button type="button" onClick={() => setLabor((cur) => [...cur, { label: '', price: '' }])} className="text-sm font-medium text-brand hover:underline">
                  + Ajouter une ligne
                </button>
              )}
            </div>
          )}
        </div>

        {/* Message et validité */}
        <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
          <label className="block text-sm">
            <span className="mb-1 block text-gray-600">Petit mot pour le client (facultatif)</span>
            <textarea className={input} rows={3} maxLength={1500} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Suite à votre demande, voici le détail pour la réparation de votre iPhone 13…" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-gray-600">Valable</span>
            <select className={input} value={validDays} onChange={(e) => setValidDays(Number(e.target.value))}>
              <option value={7}>7 jours</option>
              <option value={14}>14 jours</option>
              <option value={30}>30 jours</option>
            </select>
          </label>
        </div>

        {/* Total + actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-gray-50 px-4 py-3">
          <div className="text-sm text-gray-600">
            {lines.length > 0 && <span>Pièces {eur(partsSum)}</span>}
            {lines.length > 0 && parsedLabor.length > 0 && <span> · </span>}
            {parsedLabor.length > 0 && <span>Main d’œuvre {eur(laborSum)}</span>}
          </div>
          <div className="text-lg font-extrabold text-gray-900">Total TTC {eur(partsSum + laborSum)}</div>
        </div>

        {notice && (
          <div className={`rounded-lg px-4 py-3 text-sm ${notice.kind === 'ok' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>
            {notice.text}
            {notice.token && (
              <>
                {' '}
                <button type="button" onClick={() => copy(notice.token!)} className="font-semibold underline">
                  Copier le lien
                </button>
                {' · '}
                <a href={`/proposition/${notice.token}`} target="_blank" rel="noreferrer" className="font-semibold underline">
                  Voir ce que voit le client
                </a>
              </>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button type="button" disabled={busy} onClick={() => submit(true)} className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50">
            {busy ? 'Un instant…' : '✉️ Enregistrer et envoyer par e-mail'}
          </button>
          <button type="button" disabled={busy} onClick={() => submit(false)} className="rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            Enregistrer seulement
          </button>
        </div>
      </section>

      {/* Liste */}
      <section className="rounded-xl border border-gray-100 bg-white p-5">
        <h2 className="mb-3 font-semibold">Propositions envoyées ({proposals.length})</h2>
        {proposals.length === 0 ? (
          <p className="text-sm text-gray-500">Aucune proposition pour le moment.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {proposals.map((p) => {
              const expired = isExpired(p, today);
              return (
                <div key={p.token} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                  <div className="min-w-0 flex-1 basis-56">
                    <div className="truncate text-sm font-semibold">{p.customerName || p.customerEmail || 'Sans nom'}</div>
                    <div className="truncate text-xs text-gray-500">
                      {p.customerName && p.customerEmail ? `${p.customerEmail} · ` : ''}
                      {p.items.length} produit{p.items.length > 1 ? 's' : ''}
                      {p.labor.length > 0 ? ' + main d’œuvre' : ''} · jusqu’au {dateFr(p.validUntil)}
                    </div>
                  </div>
                  <div className="text-sm font-bold tabular-nums">{eur(proposalTotal(p))}</div>
                  <div className="flex flex-wrap gap-1.5 text-[11px] font-medium">
                    {p.sentAt ? (
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">Envoyée {dateTimeFr(p.sentAt)}</span>
                    ) : (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">Pas envoyée</span>
                    )}
                    {p.viewCount > 0 && <span className="rounded-full bg-green-50 px-2 py-0.5 text-green-700">Consultée ({p.viewCount})</span>}
                    {expired && <span className="rounded-full bg-orange-50 px-2 py-0.5 text-orange-700">Expirée</span>}
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs">
                    <button type="button" onClick={() => edit(p)} className="font-medium text-brand hover:underline">Modifier</button>
                    <button type="button" onClick={() => copy(p.token)} className="font-medium text-brand hover:underline">Copier le lien</button>
                    {p.customerEmail && (
                      <button type="button" disabled={busy} onClick={() => resend(p)} className="font-medium text-brand hover:underline disabled:opacity-50">
                        {p.sentAt ? 'Renvoyer' : 'Envoyer'}
                      </button>
                    )}
                    <button type="button" disabled={busy} onClick={() => remove(p)} className="font-medium text-red-600 hover:underline disabled:opacity-50">Supprimer</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
