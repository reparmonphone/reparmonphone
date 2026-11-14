'use client';

import { useMemo, useState } from 'react';
import { savePromoPopup, fetchProductForPopup } from './actions';
import PromoPopupView from '@/components/PromoPopupView';
import { buildPayload, DEFAULT_PROMO, type PromoConfig } from '@/lib/promoPopup';

const input = 'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none';
const label = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500';

export default function PopupForm({ initial, today }: { initial: PromoConfig; today: string }) {
  const [c, setC] = useState<PromoConfig>(initial);
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [productInput, setProductInput] = useState('');
  const [full, setFull] = useState(false);
  const set = <K extends keyof PromoConfig>(k: K, v: PromoConfig[K]) => setC((p) => ({ ...p, [k]: v }));
  const preview = useMemo(() => buildPayload({ ...c, bullets: c.bullets.filter((b) => b.trim() !== '') }), [c]);

  function fill() {
    setMsg(null);
    setPending(true);
    fetchProductForPopup(productInput)
      .then((res) => {
        if ('error' in res && res.error) return setMsg({ ok: false, text: res.error });
        if (!('product' in res) || !res.product) return;
        const p = res.product;
        setC((prev) => ({ ...prev, title: p.title.slice(0, 90), price: p.price, oldPrice: p.oldPrice, imageUrl: p.imageUrl, ctaHref: p.href }));
        setMsg({ ok: true, text: 'Produit repris : vérifie le titre (tu peux le raccourcir) puis enregistre.' });
      })
      .catch(() => setMsg({ ok: false, text: 'Une erreur est survenue, réessaie dans un instant.' }))
      .finally(() => setPending(false));
  }

  function save() {
    setMsg(null);
    setPending(true);
    savePromoPopup(c)
      .then((res) => {
        if ('error' in res && res.error) return setMsg({ ok: false, text: res.error });
        if ('config' in res && res.config) setC(res.config);
        setMsg({
          ok: true,
          text: c.enabled
            ? 'Enregistré. Le pop-up est visible des visiteurs d’ici ~1 minute.'
            : 'Enregistré. Le pop-up n’est pas activé : les visiteurs ne voient rien.',
        });
      })
      .catch(() => setMsg({ ok: false, text: 'Une erreur est survenue, réessaie dans un instant.' }))
      .finally(() => setPending(false));
  }

  const bullets = [...c.bullets, '', '', '', ''].slice(0, 4);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <div className="space-y-5">
        <section className="rounded-xl border border-gray-100 bg-white p-5">
          <label className="flex cursor-pointer items-center gap-3">
            <input type="checkbox" checked={c.enabled} onChange={(e) => set('enabled', e.target.checked)} className="h-5 w-5 accent-brand" />
            <span className="font-semibold">Activer le pop-up sur le site</span>
          </label>
          <p className="mt-1 text-xs text-gray-500">Décoché : les visiteurs ne voient rien, tu peux préparer tranquillement.</p>
        </section>

        <section className="rounded-xl border border-gray-100 bg-white p-5">
          <h2 className="mb-3 font-semibold">1. Reprendre un produit (facultatif)</h2>
          <div className="flex gap-2">
            <input className={input} placeholder="Adresse de la fiche, ex. reparmonphone.fr/produit/iphone-se-2020…" value={productInput} onChange={(e) => setProductInput(e.target.value)} />
            <button type="button" onClick={fill} disabled={pending || !productInput.trim()} className="shrink-0 rounded-lg bg-gray-900 px-4 text-sm font-semibold text-white disabled:opacity-50">
              Reprendre
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500">Remplit le titre, le prix, l’image et le lien du bouton à partir de la fiche.</p>
        </section>

        <section className="space-y-3 rounded-xl border border-gray-100 bg-white p-5">
          <h2 className="font-semibold">2. Contenu</h2>
          <div>
            <span className={label}>Étiquette</span>
            <input className={input} value={c.badge} maxLength={60} onChange={(e) => set('badge', e.target.value)} />
          </div>
          <div>
            <span className={label}>Titre</span>
            <input className={input} value={c.title} maxLength={90} onChange={(e) => set('title', e.target.value)} />
          </div>
          <div>
            <span className={label}>Phrase d’accroche</span>
            <input className={input} value={c.text} maxLength={200} onChange={(e) => set('text', e.target.value)} />
          </div>
          <div>
            <span className={label}>Points forts (4 maximum)</span>
            <div className="space-y-2">
              {bullets.map((b, i) => (
                <input
                  key={i}
                  className={input}
                  value={b}
                  maxLength={70}
                  placeholder={`Point fort ${i + 1}`}
                  onChange={(e) => {
                    const next = [...bullets];
                    next[i] = e.target.value;
                    set('bullets', next);
                  }}
                />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className={label}>Prix affiché</span>
              <input className={input} value={c.price} maxLength={30} placeholder="149,00 €" onChange={(e) => set('price', e.target.value)} />
            </div>
            <div>
              <span className={label}>Ancien prix barré (option)</span>
              <input className={input} value={c.oldPrice} maxLength={30} onChange={(e) => set('oldPrice', e.target.value)} />
            </div>
          </div>
          <div>
            <span className={label}>Image (adresse)</span>
            <input className={input} value={c.imageUrl} placeholder="https://… ou /…" onChange={(e) => set('imageUrl', e.target.value)} />
          </div>
        </section>

        <section className="space-y-3 rounded-xl border border-gray-100 bg-white p-5">
          <h2 className="font-semibold">3. Boutons</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className={label}>Texte du bouton</span>
              <input className={input} value={c.ctaLabel} maxLength={40} onChange={(e) => set('ctaLabel', e.target.value)} />
            </div>
            <div>
              <span className={label}>Lien du bouton</span>
              <input className={input} value={c.ctaHref} placeholder="/produit/…" onChange={(e) => set('ctaHref', e.target.value)} />
            </div>
          </div>
          <div>
            <span className={label}>Texte « refuser »</span>
            <input className={input} value={c.dismissLabel} maxLength={30} onChange={(e) => set('dismissLabel', e.target.value)} />
          </div>
        </section>

        <section className="space-y-3 rounded-xl border border-gray-100 bg-white p-5">
          <h2 className="font-semibold">4. Quand l’afficher</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className={label}>Délai (secondes)</span>
              <input type="number" min={0} max={60} className={input} value={c.delaySeconds} onChange={(e) => set('delaySeconds', Number(e.target.value))} />
            </div>
            <div>
              <span className={label}>Revoir au bout de (jours)</span>
              <input type="number" min={0} max={60} className={input} value={c.repeatDays} onChange={(e) => set('repeatDays', Number(e.target.value))} />
            </div>
          </div>
          <p className="text-xs text-gray-500">
            « 0 jour » = une seule fois par visite. Un visiteur qui ferme le pop-up ne le revoit pas avant ce nombre de jours (sauf si tu modifies son contenu).
          </p>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={c.scheduleEnabled} onChange={(e) => set('scheduleEnabled', e.target.checked)} className="accent-brand" />
            Limiter à une période
          </label>
          {c.scheduleEnabled && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className={label}>Début</span>
                <input type="date" className={input} value={c.start} min={today} onChange={(e) => set('start', e.target.value)} />
              </div>
              <div>
                <span className={label}>Fin</span>
                <input type="date" className={input} value={c.end} min={c.start || today} onChange={(e) => set('end', e.target.value)} />
              </div>
            </div>
          )}
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={save} disabled={pending} className="rounded-lg bg-brand px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
            {pending ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          <button type="button" onClick={() => setC(DEFAULT_PROMO)} className="text-sm text-gray-500 underline">
            Remettre les valeurs d’exemple
          </button>
          {msg && <p className={`text-sm ${msg.ok ? 'text-green-700' : 'text-red-600'}`}>{msg.text}</p>}
        </div>
      </div>

      <div className="lg:sticky lg:top-6 lg:self-start">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Aperçu en direct</p>
        <div className="rounded-2xl bg-gray-200/70 p-4">
          <PromoPopupView data={preview} inline />
        </div>
        <button type="button" onClick={() => setFull(true)} className="mt-3 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold hover:border-brand">
          Voir en grand, comme un visiteur
        </button>
      </div>

      {full && <PromoPopupView data={preview} onClose={() => setFull(false)} onCta={() => setFull(false)} />}
    </div>
  );
}
