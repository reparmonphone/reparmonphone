'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { FinderBrand, FinderModel } from '@/lib/partFinder';
import { formatPrice } from '@/lib/format';

// Logos de marque déjà présents dans public/categories/. Les autres marques reçoivent une pastille à initiale.
const BRAND_LOGOS: Record<string, string> = {
  apple: '/categories/logo-apple.png',
  samsung: '/categories/logo-samsung.png',
  huawei: '/categories/logo-huawei.png',
  xiaomi: '/categories/logo-xiaomi.png',
};

const PIECE_ICONS: Record<string, string> = {
  ECRAN: '📱',
  BATTERIE: '🔋',
  NAPPE_CONNECTEUR: '🔌',
  CAMERA: '📷',
  VITRE_ARRIERE: '🔲',
  HAUT_PARLEUR: '🔊',
  VIBREUR: '📳',
  BOUTON: '🔘',
  CHASSIS: '🧩',
};

type Mode = 'finder' | 'quote' | 'device';

const COPY: Record<Mode, { eyebrow: string; title: string; sub: string; last: string }> = {
  finder: {
    eyebrow: 'Trouveur de pièces',
    title: 'Trouvez la bonne pièce pour votre smartphone ou tablette',
    sub: 'Marque, modèle, pièce : en quelques clics, sans erreur de compatibilité.',
    last: 'Pièce',
  },
  quote: {
    eyebrow: 'Devis instantané',
    title: 'Votre devis de réparation en 30 secondes',
    sub: 'Choisissez votre smartphone ou tablette et votre panne : le prix s’affiche tout de suite, puis vous prenez rendez-vous.',
    last: 'Panne',
  },
  device: {
    eyebrow: 'Mes appareils',
    title: 'Ajouter un appareil',
    sub: 'Choisissez votre marque, puis votre modèle.',
    last: 'Ajout',
  },
};

const CSS = `
.pf-wrap{position:relative;isolation:isolate;overflow:hidden;overflow:clip;padding:3.5rem 1rem}
.pf-wrap.compact{padding:0;overflow:visible}
.pf-wrap.compact::before,.pf-wrap.compact .pf-bg{display:none}
.pf-bg{position:absolute;inset:0;z-index:-1;overflow:hidden;overflow:clip;pointer-events:none}
.pf-wrap::before{content:'';position:absolute;inset:0;z-index:-2;background:linear-gradient(180deg,#fff 0%,#eef6fd 48%,#fff 100%)}
.pf-orb{position:absolute;border-radius:9999px;filter:blur(64px);opacity:.6;animation:pf-drift 14s ease-in-out infinite alternate}
.pf-orb.a{width:340px;height:340px;left:-90px;top:10px;background:#bfe0fb}
.pf-orb.b{width:300px;height:300px;right:-70px;bottom:0;background:#d6e8ff;animation-delay:-6s}
@keyframes pf-drift{to{transform:translate3d(46px,-30px,0) scale(1.14)}}
@property --pf-a{syntax:'<angle>';inherits:false;initial-value:0deg}
.pf-card{position:relative;max-width:56rem;margin:0 auto;padding:2.5rem 1.25rem 2.25rem;border-radius:1.6rem;text-align:center;border:2px solid transparent;
  background:linear-gradient(#fff,#fff) padding-box,conic-gradient(from var(--pf-a),#0E7FDB,#9fd3f8,#E8F3FC,#0B5FA5,#0E7FDB) border-box;
  box-shadow:0 28px 60px -28px rgba(14,127,219,.45);animation:pf-spin 9s linear infinite}
@keyframes pf-spin{to{--pf-a:360deg}}
.pf-eyebrow{display:inline-flex;align-items:center;gap:.5rem;padding:.3rem .85rem;border-radius:9999px;background:#E8F3FC;color:#0B5FA5;font-size:.7rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase}
.pf-eyebrow i{width:6px;height:6px;border-radius:9999px;background:#0E7FDB;animation:pf-pulse 2s ease-in-out infinite}
.pf-title{margin:.9rem auto 0;max-width:34rem;font-size:1.7rem;line-height:1.15;font-weight:800;letter-spacing:-.02em;
  background:linear-gradient(90deg,#0B5FA5,#0E7FDB,#3aa8f0,#0B5FA5);background-size:220% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:pf-shine 7s linear infinite}
@keyframes pf-shine{to{background-position:220% 0}}
@media(min-width:768px){.pf-title{font-size:2.15rem}}
.pf-sub{margin:.7rem auto 0;max-width:32rem;font-size:.95rem;color:#64748b}

.pf-steps{display:flex;justify-content:center;max-width:32rem;margin:1.75rem auto 2rem;padding:0;list-style:none}
.pf-step{flex:1;position:relative;display:flex;flex-direction:column;align-items:center;gap:.4rem;font-size:.72rem;font-weight:600;color:#94a3b8}
.pf-step+.pf-step::before{content:'';position:absolute;top:15px;right:50%;width:100%;height:2px;background:#e2e8f0;z-index:0;transition:background .4s}
.pf-step.done+.pf-step::before,.pf-step.done+.pf-step.cur::before{background:#0E7FDB}
.pf-dot{position:relative;z-index:1;display:grid;place-items:center;width:32px;height:32px;border-radius:9999px;background:#fff;border:2px solid #cbd5e1;font-size:.8rem;font-weight:700;transition:all .35s}
.pf-step.done{color:#0B5FA5}.pf-step.done .pf-dot{background:#0E7FDB;border-color:#0E7FDB;color:#fff}
.pf-step.cur{color:#0f172a}.pf-step.cur .pf-dot{border-color:#0E7FDB;color:#0E7FDB;box-shadow:0 0 0 5px rgba(14,127,219,.16);animation:pf-pulse 2s ease-in-out infinite}
@keyframes pf-pulse{50%{box-shadow:0 0 0 9px rgba(14,127,219,.04)}}

.pf-block{margin-top:1.75rem;animation:pf-in .5s cubic-bezier(.2,.8,.2,1) both}
.pf-label{margin-bottom:.9rem;font-size:.72rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#94a3b8}
@keyframes pf-in{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
.pf-grid{display:flex;flex-wrap:wrap;justify-content:center;gap:.9rem}

.pf-tile{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.55rem;min-width:8rem;padding:1.05rem 1.2rem;border-radius:1.1rem;
  background:#fff;border:1.5px solid #e2e8f0;color:#0f172a;font-weight:700;font-size:.92rem;line-height:1.2;cursor:pointer;text-decoration:none;overflow:hidden;
  box-shadow:0 1px 2px rgba(15,23,42,.05);transition:transform .22s,box-shadow .22s,border-color .22s,background .22s;animation:pf-in .5s cubic-bezier(.2,.8,.2,1) both}
.pf-tile::after{content:'';position:absolute;top:0;bottom:0;left:-70%;width:45%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.65),transparent);transform:skewX(-18deg);transition:left .6s}
.pf-tile:hover{transform:translateY(-5px);border-color:#0E7FDB;box-shadow:0 18px 30px -16px rgba(14,127,219,.6)}
.pf-tile:hover::after{left:130%}
.pf-tile:focus-visible,.pf-select:focus-visible{outline:3px solid rgba(14,127,219,.4);outline-offset:2px}
.pf-tile.sel{background:linear-gradient(135deg,#0E7FDB,#0B5FA5);border-color:transparent;color:#fff;box-shadow:0 18px 30px -14px rgba(14,127,219,.75)}
.pf-tile.sel::before{content:'✓';position:absolute;top:.45rem;right:.55rem;display:grid;place-items:center;width:20px;height:20px;border-radius:9999px;background:#fff;color:#0E7FDB;font-size:.7rem;font-weight:800;animation:pf-pop .35s cubic-bezier(.2,1.6,.4,1) both}
@keyframes pf-pop{from{transform:scale(0)}to{transform:scale(1)}}
.pf-logo{display:grid;place-items:center;height:2.4rem}
.pf-logo img{max-height:2.4rem;max-width:5.5rem;width:auto;object-fit:contain}
.pf-mono{display:grid;place-items:center;width:2.4rem;height:2.4rem;border-radius:9999px;background:#E8F3FC;color:#0B5FA5;font-weight:800}
.pf-tile.sel .pf-logo img{filter:brightness(0) invert(1)}
.pf-tile.sel .pf-mono{background:rgba(255,255,255,.2);color:#fff}
.pf-pill.sel::before{display:none}
.pf-ico{font-size:1.7rem;line-height:1}
.pf-meta{font-size:.72rem;font-weight:600;color:#64748b}
.pf-tile.sel .pf-meta{color:rgba(255,255,255,.85)}
.pf-pill{padding:.6rem 1.15rem;min-width:0;flex-direction:row;font-size:.88rem;border-radius:9999px}
.pf-link{color:#0E7FDB}
.pf-tile.alt{background:transparent;border-style:dashed;color:#475569}

.pf-select{display:block;width:100%;max-width:26rem;margin:0 auto;padding:.95rem 1.1rem;border-radius:.95rem;border:1.5px solid #cbd5e1;background:#fff;color:#0f172a;font-size:.95rem;font-weight:600;text-align:center;text-align-last:center;cursor:pointer;transition:border-color .2s,box-shadow .2s}
.pf-select:hover{border-color:#0E7FDB}.pf-select:focus{border-color:#0E7FDB;box-shadow:0 0 0 4px rgba(14,127,219,.15)}
.pf-skel{width:100%;max-width:26rem;height:3.1rem;margin:0 auto;border-radius:.95rem;background:linear-gradient(90deg,#e2e8f0 25%,#f1f5f9 50%,#e2e8f0 75%);background-size:200% 100%;animation:pf-sk 1.2s linear infinite}
@keyframes pf-sk{to{background-position:-200% 0}}

.pf-quote{max-width:26rem;margin:0 auto;padding:1.4rem;border-radius:1.2rem;text-align:left;background:linear-gradient(180deg,#f3f9fe,#fff);border:1.5px solid rgba(14,127,219,.3);box-shadow:0 18px 40px -24px rgba(14,127,219,.5);animation:pf-in .5s cubic-bezier(.2,.8,.2,1) both}
.pf-quote dl{margin:.9rem 0 0;color:#334155;font-size:.9rem}
.pf-quote .row{display:flex;justify-content:space-between;gap:1rem;padding:.35rem 0}
.pf-quote .row dd{margin:0;font-weight:700;color:#0f172a;text-align:right}
.pf-quote .tot{margin-top:.4rem;padding-top:.7rem;border-top:1px solid rgba(14,127,219,.25);font-size:1.05rem}
.pf-quote .tot dd{font-size:1.25rem;font-weight:800;color:#0B5FA5}
.pf-btn{display:inline-flex;align-items:center;justify-content:center;gap:.5rem;padding:.8rem 1.4rem;border-radius:.85rem;font-size:.9rem;font-weight:700;text-decoration:none;cursor:pointer;border:1.5px solid #0E7FDB;transition:transform .2s,box-shadow .2s,background .2s}
.pf-btn:hover{transform:translateY(-2px);box-shadow:0 12px 22px -12px rgba(14,127,219,.7)}
.pf-btn.pri{background:linear-gradient(135deg,#0E7FDB,#0B5FA5);color:#fff;border-color:transparent}
.pf-btn.sec{background:#fff;color:#0E7FDB}
.pf-btn:disabled{opacity:.6;cursor:wait}
.pf-foot{margin-top:2rem;font-size:.88rem;color:#64748b}
.pf-foot a{font-weight:700;color:#0E7FDB;text-decoration:none}.pf-foot a:hover{text-decoration:underline}

html[data-theme='dark'] .pf-wrap::before{background:linear-gradient(180deg,#0b1220 0%,#0d1b33 48%,#0b1220 100%)}
html[data-theme='dark'] .pf-orb{opacity:.2}
html[data-theme='dark'] .pf-card{background:linear-gradient(#111a2e,#111a2e) padding-box,conic-gradient(from var(--pf-a),#0E7FDB,#1b4f80,#0f2a47,#0B5FA5,#0E7FDB) border-box;box-shadow:0 28px 60px -28px rgba(0,0,0,.8)}
html[data-theme='dark'] .pf-eyebrow{background:#0f2a47;color:#7cc3f7}
html[data-theme='dark'] .pf-title{background-image:linear-gradient(90deg,#7cc3f7,#4aa8ec,#b6dcfa,#7cc3f7);background-size:220% 100%;-webkit-background-clip:text;background-clip:text}
html[data-theme='dark'] .pf-sub,html[data-theme='dark'] .pf-foot{color:#94a3b8}
html[data-theme='dark'] .pf-dot{background:#111a2e;border-color:#33446a}
html[data-theme='dark'] .pf-step.done .pf-dot{background:#0E7FDB;border-color:#0E7FDB}
html[data-theme='dark'] .pf-step.done{color:#7cc3f7}
html[data-theme='dark'] .pf-step.cur{color:#f1f5f9}
html[data-theme='dark'] .pf-step+.pf-step::before{background:#263554}
html[data-theme='dark'] .pf-quote{background:linear-gradient(180deg,#0f2036,#111a2e);color:#cdd5e3}
html[data-theme='dark'] .pf-quote dl,html[data-theme='dark'] .pf-quote .row dd{color:#e5eaf2}
html[data-theme='dark'] .pf-quote p{color:#cbd5e1!important}
html[data-theme='dark'] .pf-quote .tot dd{color:#7cc3f7}
html[data-theme='dark'] .pf-btn.sec{background:#111a2e;color:#7cc3f7;border-color:#2a5f93}
html[data-theme='dark'] .pf-tile:not(.pf-brand):not(.sel){background:#16213a;border-color:#2a3a5c;color:#e5eaf2}
html[data-theme='dark'] .pf-tile:not(.pf-brand):not(.sel) .pf-meta{color:#94a3b8}
html[data-theme='dark'] .pf-tile.alt{background:transparent;color:#94a3b8}
html[data-theme='dark'] .pf-select{background:#0e1628;color:#e5eaf2;border-color:#2a3a5c}
html[data-theme='dark'] .pf-skel{background:linear-gradient(90deg,#17223a 25%,#1e2b47 50%,#17223a 75%);background-size:200% 100%}

@media (prefers-reduced-motion:reduce){
  .pf-card,.pf-orb,.pf-title,.pf-eyebrow i,.pf-step.cur .pf-dot,.pf-block,.pf-tile,.pf-quote,.pf-skel{animation:none!important}
  .pf-tile,.pf-btn{transition:none}.pf-tile::after{display:none}
}
`;

export default function PartFinderClient({
  brands,
  mode = 'finder',
  labor = {},
  addDevice,
}: {
  brands: FinderBrand[];
  mode?: Mode;
  // Mode « device » (Mes appareils) : action serveur qui enregistre le modèle choisi dans le compte.
  addDevice?: (modelId: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  // Main d'œuvre par type de panne (voir src/data/reparationTarifs.ts), utilisée seulement en mode devis.
  labor?: Record<string, number>;
}) {
  const quote = mode === 'quote';
  const device = mode === 'device';
  const copy = COPY[mode];
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
  const multiLine = !brand || brand.lines.length > 1;

  async function loadModels(b: string, l: string) {
    setLineSlug(l);
    setModels(null);
    setModelSlug('');
    setPieceType(null);
    setDeviceMsg(null);
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
    setDeviceMsg(null);
    setFailed(false);
    // Une seule gamme : inutile de la faire choisir.
    if (b.lines.length === 1) void loadModels(b.slug, b.lines[0].slug);
    else setLineSlug(null);
  }

  // Étapes affichées dans la frise (la gamme disparaît quand la marque n'en a qu'une).
  const steps = [
    { key: 'brand', label: 'Marque', done: !!brand },
    ...(multiLine ? [{ key: 'line', label: 'Gamme', done: !!lineSlug }] : []),
    { key: 'model', label: 'Modèle', done: !!model },
    { key: 'last', label: copy.last, done: quote ? !!pieceType : false },
  ];
  const current = steps.findIndex((s) => !s.done);
  const stepNo = (key: string) => steps.findIndex((s) => s.key === key) + 1;

  return (
    <section className={`pf-wrap${device ? ' compact' : ''}`} aria-labelledby="finder-title">
      <style>{CSS}</style>
      <div className="pf-bg" aria-hidden="true">
        <span className="pf-orb a" />
        <span className="pf-orb b" />
      </div>

      <div className="pf-card">
        <span className="pf-eyebrow">
          <i aria-hidden="true" />
          {copy.eyebrow}
        </span>
        <h2 id="finder-title" className="pf-title">
          {copy.title}
        </h2>
        <p className="pf-sub">{copy.sub}</p>

        <ol className="pf-steps" aria-label="Étapes">
          {steps.map((s, i) => (
            <li key={s.key} className={`pf-step ${s.done ? 'done' : i === current ? 'cur' : ''}`} aria-current={i === current ? 'step' : undefined}>
              <span className="pf-dot">{s.done ? '✓' : i + 1}</span>
              {s.label}
            </li>
          ))}
        </ol>

        {/* 1 · Marque */}
        <div className="pf-block" style={{ marginTop: 0 }}>
          <p className="pf-label">{stepNo('brand')} · Votre marque</p>
          <div className="pf-grid">
            {brands.map((b, i) => {
              const logo = BRAND_LOGOS[b.slug];
              return (
                <button
                  key={b.slug}
                  type="button"
                  className={`pf-tile pf-brand${b.slug === brandSlug ? ' sel' : ''}`}
                  style={{ animationDelay: `${i * 70}ms` }}
                  onClick={() => pickBrand(b)}
                  aria-pressed={b.slug === brandSlug}
                >
                  {logo ? (
                    <span className="pf-logo">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={logo} alt="" loading="lazy" />
                    </span>
                  ) : (
                    <span className="pf-mono" aria-hidden="true">
                      {b.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  {b.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* 2 · Gamme */}
        {brand && brand.lines.length > 1 && (
          <div className="pf-block" key={`line-${brand.slug}`}>
            <p className="pf-label">{stepNo('line')} · Votre gamme</p>
            <div className="pf-grid">
              {brand.lines.map((l, i) => (
                <button
                  key={l.slug}
                  type="button"
                  className={`pf-tile pf-pill${l.slug === lineSlug ? ' sel' : ''}`}
                  style={{ animationDelay: `${i * 50}ms` }}
                  onClick={() => void loadModels(brand.slug, l.slug)}
                  aria-pressed={l.slug === lineSlug}
                >
                  {l.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 3 · Modèle */}
        {lineSlug && (
          <div className="pf-block" key={`model-${brandSlug}-${lineSlug}`}>
            <p className="pf-label">{stepNo('model')} · Votre modèle</p>
            {loading && <div className="pf-skel" aria-label="Chargement des modèles" />}
            {failed && (
              <p className="pf-foot" style={{ color: '#dc2626', marginTop: 0 }}>
                Impossible de charger les modèles pour le moment.{' '}
                <Link href="/boutique">Voir toute la boutique</Link>
              </p>
            )}
            {models && models.length === 0 && (
              <p className="pf-foot" style={{ marginTop: 0 }}>
                Aucune pièce en stock pour cette gamme. <Link href="/contact">Écrivez-nous</Link>, nous pouvons peut-être la commander.
              </p>
            )}
            {models && models.length > 0 && (
              <select
                className="pf-select"
                value={modelSlug}
                onChange={(e) => {
                  setModelSlug(e.target.value);
                  setPieceType(null);
                  setDeviceMsg(null);
                }}
                aria-label="Votre modèle"
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

        {/* 4 · Pièce (trouveur) */}
        {model && !quote && !device && (
          <div className="pf-block" key={`pieces-${model.slug}`}>
            <p className="pf-label">
              {stepNo('last')} · La pièce dont vous avez besoin pour {model.name}
            </p>
            <div className="pf-grid">
              {model.pieces.map((p, i) => (
                <Link key={p.slug} href={p.href} className="pf-tile" style={{ animationDelay: `${i * 60}ms` }}>
                  <span className="pf-ico" aria-hidden="true">
                    {PIECE_ICONS[p.type] ?? '🔧'}
                  </span>
                  {p.label}
                  <span className="pf-meta">
                    {p.count} réf. · dès {formatPrice(p.minPrice)}
                  </span>
                </Link>
              ))}
              <Link href={model.href} className="pf-tile alt" style={{ animationDelay: `${model.pieces.length * 60}ms` }}>
                <span className="pf-ico" aria-hidden="true">
                  ✦
                </span>
                Toutes les pièces
                <span className="pf-meta">voir tout →</span>
              </Link>
            </div>
          </div>
        )}

        {/* 4 · Panne (devis) */}
        {model && quote && (
          <div className="pf-block" key={`panne-${model.slug}`}>
            <p className="pf-label">{stepNo('last')} · Votre panne</p>
            <div className="pf-grid">
              {model.pieces.map((p, i) => (
                <button
                  key={p.type}
                  type="button"
                  className={`pf-tile${p.type === pieceType ? ' sel' : ''}`}
                  style={{ animationDelay: `${i * 60}ms` }}
                  onClick={() => setPieceType(p.type)}
                  aria-pressed={p.type === pieceType}
                >
                  <span className="pf-ico" aria-hidden="true">
                    {PIECE_ICONS[p.type] ?? '🔧'}
                  </span>
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
            <div className="pf-block" key={`q-${model.slug}-${piece.type}`} aria-live="polite">
              <div className="pf-quote">
                <p style={{ margin: 0, fontWeight: 700, color: '#0f172a' }}>
                  Remplacement {piece.singular} · {model.name}
                </p>
                <dl>
                  <div className="row">
                    <dt>Pièce (dès)</dt>
                    <dd>{formatPrice(piece.minPrice)}</dd>
                  </div>
                  <div className="row">
                    <dt>Pose en atelier</dt>
                    <dd>{hasPose ? formatPrice(pose) : 'tarif confirmé au rendez-vous'}</dd>
                  </div>
                  {hasPose && (
                    <div className="row tot">
                      <dt style={{ fontWeight: 700 }}>Total estimé (dès)</dt>
                      <dd>{formatPrice(piece.minPrice + pose)}</dd>
                    </div>
                  )}
                </dl>
                <p style={{ margin: '.6rem 0 0', fontSize: '.75rem', color: '#64748b' }}>
                  Estimation indicative, selon la qualité de pièce choisie (origine ou compatible).
                </p>
                <div style={{ marginTop: '1rem', display: 'flex', flexWrap: 'wrap', gap: '.7rem' }}>
                  <Link href={rdv} className="pf-btn pri">
                    📅 Prendre rendez-vous
                  </Link>
                  <Link href={`/produit/${piece.productSlug}`} className="pf-btn sec">
                    🛒 Acheter la pièce seule
                  </Link>
                </div>
              </div>
            </div>
          );
        })()}

        {/* 4 · Ajout (Mes appareils) */}
        {model && device && addDevice && (
          <div className="pf-block" key={`d-${model.slug}`}>
            <button
              type="button"
              className="pf-btn pri"
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
            >
              {deviceBusy ? 'Ajout…' : `Ajouter ${model.name} à mes appareils`}
            </button>
          </div>
        )}
        {device && deviceMsg && (
          <p className="pf-foot" style={{ color: deviceMsg.ok ? '#16a34a' : '#dc2626', fontWeight: 600 }} role="status">
            {deviceMsg.text}
          </p>
        )}

        {!quote && !device && (
          <p className="pf-foot">
            Vous préférez qu&apos;on la pose pour vous ? <Link href="/devis-reparation">Obtenez votre devis de réparation →</Link>
          </p>
        )}
      </div>
    </section>
  );
}
