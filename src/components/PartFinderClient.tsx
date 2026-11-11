'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { FinderBrand, FinderModel } from '@/lib/partFinder';
import { formatPrice } from '@/lib/format';

const chip = (active: boolean) =>
  `rounded-full border px-4 py-2 text-sm font-semibold transition ${
    active
      ? 'border-brand bg-brand text-white shadow'
      : 'border-gray-200 bg-white text-gray-700 hover:border-brand hover:text-brand'
  }`;

export default function PartFinderClient({
  brands,
  mode = 'finder',
  labor = {},
  addDevice,
}: {
  brands: FinderBrand[];
  mode?: 'finder' | 'quote' | 'device';
  // Mode « device » (Mes appareils) : action serveur qui enregistre le modèle choisi dans le compte.
  addDevice?: (modelId: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  // Main d'œuvre par type de panne (voir src/data/reparationTarifs.ts), utilisée seulement en mode devis.
  labor?: Record<string, number>;
}) {
  const quote = mode === 'quote';
  const device = mode === 'device';
  const router = useRouter();
  const [deviceMsg, setDeviceMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [deviceBusy, setDeviceBusy] = useState(false);
  const [pieceType, setPieceType] = useState<string | null>(null);
  const [brandSlug, setBrandSlug] = useState<string | null>(null);
  const [lineSlug, setLineSlug] = useState<string | null>(null);
  const [models, setModels] = useState<FinderModel[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [modelSlug, setModelSlug] = useState('');

  const brand = brands.find((b) => b.slug === brandSlug) ?? null;
  const model = models?.find((m) => m.slug === modelSlug) ?? null;

  async function loadModels(b: string, l: string) {
    setLineSlug(l);
    setModels(null);
    setModelSlug('');
    setPieceType(null);
    setFailed(false);
    setLoading(true);
    try {
      const res = await fetch(`/api/part-finder?brand=${encodeURIComponent(b)}&line=${encodeURIComponent(l)}`);
      if (!res.ok) throw new Error('bad');
      const data = (await res.json()) as { models: FinderModel[] };
      setModels(data.models);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  function pickBrand(b: FinderBrand) {
    setBrandSlug(b.slug);
    setModels(null);
    setModelSlug('');
    setPieceType(null);
    setFailed(false);
    // Une seule gamme : inutile de la faire choisir.
    if (b.lines.length === 1) void loadModels(b.slug, b.lines[0].slug);
    else setLineSlug(null);
  }

  return (
    <section className="max-w-6xl mx-auto px-4 pt-8" aria-labelledby="finder-title">
      <div className="rounded-2xl border border-brand/20 bg-white p-5 shadow-sm md:p-7">
        <h2 id="finder-title" className="text-xl font-bold text-gray-900 md:text-2xl">
          {device
            ? '➕ Ajouter un appareil'
            : quote
            ? '🔧 Votre devis de réparation en 30 secondes'
            : '🔎 Trouvez la bonne pièce pour votre téléphone'}
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          {device
            ? 'Choisissez votre marque, puis votre modèle.'
            : quote
            ? 'Choisissez votre téléphone et votre panne : vous voyez le prix tout de suite, puis vous prenez rendez-vous.'
            : 'Marque, modèle, pièce : en quelques clics, sans erreur de compatibilité.'}
        </p>

        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">1 · Votre marque</p>
          <div className="flex flex-wrap gap-2">
            {brands.map((b) => (
              <button key={b.slug} type="button" className={chip(b.slug === brandSlug)} onClick={() => pickBrand(b)}>
                {b.name}
              </button>
            ))}
          </div>
        </div>

        {brand && brand.lines.length > 1 && (
          <div className="mt-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">2 · Votre gamme</p>
            <div className="flex flex-wrap gap-2">
              {brand.lines.map((l) => (
                <button
                  key={l.slug}
                  type="button"
                  className={chip(l.slug === lineSlug)}
                  onClick={() => void loadModels(brand.slug, l.slug)}
                >
                  {l.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {lineSlug && (
          <div className="mt-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              {brand && brand.lines.length > 1 ? '3' : '2'} · Votre modèle
            </p>
            {loading && <p className="text-sm text-gray-500">Chargement des modèles…</p>}
            {failed && (
              <p className="text-sm text-red-600">
                Impossible de charger les modèles pour le moment.{' '}
                <Link href="/boutique" className="underline">
                  Voir toute la boutique
                </Link>
              </p>
            )}
            {models && models.length === 0 && (
              <p className="text-sm text-gray-500">
                Aucune pièce en stock pour cette gamme.{' '}
                <Link href="/contact" className="text-brand underline">
                  Écrivez-nous
                </Link>
                , nous pouvons peut-être la commander.
              </p>
            )}
            {models && models.length > 0 && (
              <select
                value={modelSlug}
                onChange={(e) => {
                  setModelSlug(e.target.value);
                  setPieceType(null);
                }}
                aria-label="Votre modèle"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm md:max-w-md"
              >
                <option value="">Choisissez votre modèle…</option>
                {models.map((m) => (
                  <option key={m.slug} value={m.slug}>
                    {m.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {model && !quote && !device && (
          <div className="mt-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              {brand && brand.lines.length > 1 ? '4' : '3'} · La pièce dont vous avez besoin
            </p>
            <div className="flex flex-wrap gap-2">
              {model.pieces.map((p) => (
                <Link
                  key={p.slug}
                  href={p.href}
                  className="rounded-full border border-brand bg-brand-light px-4 py-2 text-sm font-semibold text-brand-dark transition hover:bg-brand hover:text-white"
                >
                  {p.label} <span className="opacity-60">({p.count})</span>
                </Link>
              ))}
              <Link
                href={model.href}
                className="rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:border-brand hover:text-brand"
              >
                Toutes les pièces →
              </Link>
            </div>
          </div>
        )}

        {model && quote && (
          <div className="mt-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              {brand && brand.lines.length > 1 ? '4' : '3'} · Votre panne
            </p>
            <div className="flex flex-wrap gap-2">
              {model.pieces.map((p) => (
                <button key={p.type} type="button" className={chip(p.type === pieceType)} onClick={() => setPieceType(p.type)}>
                  {p.label.replace(/s$/, '')}
                </button>
              ))}
            </div>
          </div>
        )}

        {model && quote && pieceType && brand && (() => {
          const piece = model.pieces.find((p) => p.type === pieceType);
          if (!piece) return null;
          const pose = labor[piece.type];
          const hasPose = typeof pose === 'number' && pose > 0;
          const modelShort = model.name.toLowerCase().startsWith(brand.name.toLowerCase())
            ? model.name.slice(brand.name.length).trim()
            : model.name;
          const rdv = `/rdv?${new URLSearchParams({
            marque: brand.name,
            modele: modelShort,
            panne: `Remplacement ${piece.singular}`,
          }).toString()}`;
          return (
            <div className="mt-6 rounded-xl border border-brand/30 bg-brand-light/40 p-5" aria-live="polite">
              <p className="text-sm font-semibold text-gray-900">
                Remplacement {piece.singular} · {model.name}
              </p>
              <dl className="mt-3 space-y-1.5 text-sm text-gray-700">
                <div className="flex justify-between gap-4">
                  <dt>Pièce (dès)</dt>
                  <dd className="font-semibold">{formatPrice(piece.minPrice)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>Pose en atelier</dt>
                  <dd className="font-semibold">{hasPose ? formatPrice(pose) : 'tarif confirmé au rendez-vous'}</dd>
                </div>
                {hasPose && (
                  <div className="flex justify-between gap-4 border-t border-brand/20 pt-2 text-base">
                    <dt className="font-bold text-gray-900">Total estimé (dès)</dt>
                    <dd className="font-extrabold text-brand-dark">{formatPrice(piece.minPrice + pose)}</dd>
                  </div>
                )}
              </dl>
              <p className="mt-2 text-xs text-gray-500">
                Estimation indicative, selon la qualité de pièce choisie (origine ou compatible).
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link href={rdv} className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">
                  📅 Prendre rendez-vous
                </Link>
                <Link
                  href={`/produit/${piece.productSlug}`}
                  className="rounded-lg border border-brand bg-white px-5 py-2.5 text-sm font-semibold text-brand hover:bg-brand-light"
                >
                  🛒 Acheter la pièce seule
                </Link>
              </div>
            </div>
          );
        })()}

        {model && device && addDevice && (
          <div className="mt-5">
            <button
              type="button"
              disabled={deviceBusy}
              onClick={async () => {
                setDeviceBusy(true);
                setDeviceMsg(null);
                try {
                  const res = await addDevice(model.id);
                  if (res.ok) {
                    setDeviceMsg({ ok: true, text: `${model.name} ajouté à votre compte.` });
                    setModelSlug('');
                    router.refresh();
                  } else setDeviceMsg({ ok: false, text: res.error });
                } catch {
                  setDeviceMsg({ ok: false, text: 'Une erreur est survenue, réessayez dans un instant.' });
                } finally {
                  setDeviceBusy(false);
                }
              }}
              className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
            >
              {deviceBusy ? 'Ajout…' : `Ajouter ${model.name} à mes appareils`}
            </button>
          </div>
        )}
        {device && deviceMsg && (
          <p className={`mt-3 text-sm ${deviceMsg.ok ? 'text-green-700' : 'text-red-600'}`}>{deviceMsg.text}</p>
        )}

        {!quote && !device && (
          <p className="mt-6 text-sm text-gray-500">
            Vous préférez qu&apos;on la pose pour vous ?{' '}
            <Link href="/devis-reparation" className="font-semibold text-brand hover:underline">
              Obtenez votre devis de réparation
            </Link>
            .
          </p>
        )}
      </div>
    </section>
  );
}
