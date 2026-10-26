'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createReplacementOrder, searchProductsForReplacement } from '../replacementActions';
import { CARRIER_LABELS } from '@/lib/tracking';

type OrigItem = { productId: string; title: string; quantity: number };
type Extra = { productId: string; title: string; quantity: number };
type Hit = { id: string; title: string; inStock: boolean };

export default function ReplacementPanel({
  orderId,
  items,
  address,
  customerName,
}: {
  orderId: string;
  items: OrigItem[];
  address: string;
  customerName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Articles de la commande d'origine (cochés par défaut) : quantité modifiable
  const [picked, setPicked] = useState<Record<string, { on: boolean; qty: number }>>(() =>
    Object.fromEntries(items.map((i) => [i.productId, { on: true, qty: i.quantity }]))
  );
  // Articles ajoutés à la main (ex. une autre nappe)
  const [extras, setExtras] = useState<Extra[]>([]);
  const [search, setSearch] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const searchSeq = useRef(0);

  const [reason, setReason] = useState('');
  const [status, setStatus] = useState<'PROCESSING' | 'SHIPPED'>('PROCESSING');
  const [carrier, setCarrier] = useState('');
  const [tracking, setTracking] = useState('');
  const [overrideUrl, setOverrideUrl] = useState('');
  const [notify, setNotify] = useState(true);

  // Recherche produit (avec petit délai pour ne pas interroger à chaque lettre)
  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    const seq = ++searchSeq.current;
    const t = setTimeout(async () => {
      try {
        const rows = await searchProductsForReplacement(q);
        if (seq === searchSeq.current) setHits(rows);
      } catch {
        if (seq === searchSeq.current) setHits([]);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  function addExtra(h: Hit) {
    if (items.some((i) => i.productId === h.id)) {
      setPicked((p) => ({ ...p, [h.id]: { on: true, qty: p[h.id]?.qty ?? 1 } }));
    } else if (!extras.some((e) => e.productId === h.id)) {
      setExtras((x) => [...x, { productId: h.id, title: h.title, quantity: 1 }]);
    }
    setSearch('');
    setHits([]);
  }

  const lines = [
    ...items.filter((i) => picked[i.productId]?.on).map((i) => ({ productId: i.productId, quantity: picked[i.productId].qty })),
    ...extras.map((e) => ({ productId: e.productId, quantity: e.quantity })),
  ];
  const count = lines.reduce((n, l) => n + (Number(l.quantity) || 0), 0);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (lines.length === 0) {
      setError('Sélectionne au moins un article à renvoyer.');
      return;
    }
    startTransition(async () => {
      const res = await createReplacementOrder({
        originalOrderId: orderId,
        items: lines,
        reason,
        status,
        carrier: carrier || null,
        trackingNumber: tracking,
        trackingUrlOverride: overrideUrl,
        notifyCustomer: notify,
      });
      if ('error' in res) {
        setError(res.error);
        return;
      }
      router.push(`/admin/commandes/${res.orderId}`);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-brand text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-brand-dark transition"
      >
        🔁 Renvoyer des articles
      </button>
    );
  }

  const input = 'border border-gray-200 rounded-lg px-3 py-2 text-sm';

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <p className="text-sm font-medium mb-2">Articles à renvoyer</p>
        <div className="space-y-2">
          {items.map((i) => {
            const p = picked[i.productId];
            return (
              <label key={i.productId} className="flex items-center gap-3 text-sm bg-gray-50 rounded-lg px-3 py-2">
                <input
                  type="checkbox"
                  checked={p?.on ?? false}
                  onChange={(e) => setPicked((x) => ({ ...x, [i.productId]: { on: e.target.checked, qty: x[i.productId]?.qty ?? i.quantity } }))}
                />
                <span className="flex-1">{i.title}</span>
                <span className="text-xs text-gray-400">commandé : {i.quantity}</span>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={p?.qty ?? i.quantity}
                  disabled={!p?.on}
                  onChange={(e) => setPicked((x) => ({ ...x, [i.productId]: { on: x[i.productId]?.on ?? true, qty: Math.max(1, Number(e.target.value) || 1) } }))}
                  className={`${input} w-16 py-1 disabled:opacity-40`}
                />
              </label>
            );
          })}
          {extras.map((x) => (
            <div key={x.productId} className="flex items-center gap-3 text-sm bg-blue-50 rounded-lg px-3 py-2">
              <span className="text-xs text-blue-700">+ ajouté</span>
              <span className="flex-1">{x.title}</span>
              <input
                type="number"
                min={1}
                max={99}
                value={x.quantity}
                onChange={(e) =>
                  setExtras((all) => all.map((y) => (y.productId === x.productId ? { ...y, quantity: Math.max(1, Number(e.target.value) || 1) } : y)))
                }
                className={`${input} w-16 py-1`}
              />
              <button type="button" onClick={() => setExtras((all) => all.filter((y) => y.productId !== x.productId))} className="text-red-500 text-xs hover:underline">
                Retirer
              </button>
            </div>
          ))}
        </div>

        <div className="relative mt-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="➕ Ajouter un autre article (tape 2 lettres du nom)…"
            className={`${input} w-full`}
          />
          {hits.length > 0 && (
            <ul className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-auto">
              {hits.map((h) => (
                <li key={h.id}>
                  <button type="button" onClick={() => addExtra(h)} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50">
                    {h.title} {!h.inStock && <span className="text-xs text-red-500">(rupture)</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Motif <span className="text-gray-400 font-normal">(pour toi uniquement, jamais montré au client)</span>
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          maxLength={1000}
          placeholder="ex : nappe Face ID potentiellement défectueuse, remplacement envoyé"
          className={`${input} w-full`}
        />
      </div>

      <div>
        <p className="text-sm font-medium mb-2">Statut de départ</p>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" name="rstatus" checked={status === 'PROCESSING'} onChange={() => setStatus('PROCESSING')} />
            En préparation
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="rstatus" checked={status === 'SHIPPED'} onChange={() => setStatus('SHIPPED')} />
            Déjà expédié (en livraison)
          </label>
        </div>
        <p className="text-xs text-gray-400 mt-1">Tu pourras ensuite passer le renvoi en « Expédiée » puis « Livrée » depuis sa page, comme une commande normale.</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Transporteur</label>
          <select value={carrier} onChange={(e) => setCarrier(e.target.value)} className={`${input} w-full`}>
            <option value="">— Aucun —</option>
            {Object.entries(CARRIER_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            N° de suivi <span className="text-gray-400 font-normal">(peut être ajouté plus tard)</span>
          </label>
          <input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="ex : 6A12345678901" className={`${input} w-full`} />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">
          Lien de suivi personnalisé <span className="text-gray-400 font-normal">(optionnel)</span>
        </label>
        <input value={overrideUrl} onChange={(e) => setOverrideUrl(e.target.value)} placeholder="https://..." className={`${input} w-full`} />
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="mt-0.5" />
        <span>
          Prévenir le client par e-mail
          <span className="block text-xs text-gray-400">
            {status === 'SHIPPED'
              ? '« Votre nouveau colis est en route » avec le suivi.'
              : '« Un nouvel envoi est en préparation » (le suivi lui sera envoyé dès que tu l’ajouteras).'}
          </span>
        </span>
      </label>

      <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
        Livraison à la même adresse que la commande d&apos;origine : <strong>{customerName}</strong> — {address}. Le renvoi est offert (0 €), sans facture,
        et n&apos;entre pas dans ton chiffre d&apos;affaires. La commande d&apos;origine n&apos;est pas modifiée.
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending || lines.length === 0}
          className="bg-brand text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-brand-dark transition disabled:opacity-60"
        >
          {pending ? 'Création…' : `Créer le renvoi (${count} article${count > 1 ? 's' : ''})`}
        </button>
        <button type="button" onClick={() => setOpen(false)} disabled={pending} className="text-sm text-gray-500 hover:text-gray-800">
          Annuler
        </button>
      </div>
    </form>
  );
}
