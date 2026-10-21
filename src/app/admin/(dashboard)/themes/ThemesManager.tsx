'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import {
  THEMES,
  STYLES,
  getTheme,
  effectsForStyle,
  defaultOptions,
  resolveActiveTheme,
  type EffectDef,
  type Intensity,
  type SeasonalConfig,
  type ThemeOptions,
} from '@/lib/seasonalThemes';
import { saveSeasonalConfig } from './actions';

const GROUPS: { id: EffectDef['group']; title: string; hint: string }[] = [
  { id: 'ambiance', title: 'Ambiance', hint: 'Le décor général, discret et élégant.' },
  { id: 'animations', title: 'Animations', hint: 'Ce qui bouge à l’écran.' },
  { id: 'interactif', title: 'Interactif', hint: 'Réagit à la souris ou à l’orage. Certains effets sont coupés par défaut.' },
  { id: 'commerce', title: 'Commerce', hint: 'Pour transformer l’événement en ventes.' },
];

const PAGES = [
  { href: '/', label: 'Accueil' },
  { href: '/boutique', label: 'Boutique' },
  { href: '/panier', label: 'Panier (mode discret)' },
];

const INTENSITIES: { id: Intensity; label: string; hint: string }[] = [
  { id: 'doux', label: 'Doux', hint: 'Peu d’éléments, très sobre' },
  { id: 'normal', label: 'Normal', hint: 'Recommandé' },
  { id: 'intense', label: 'Intense', hint: 'Plus de chauves-souris et de braises' },
];

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${checked ? 'bg-orange-500' : 'bg-gray-300'}`}
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  );
}

function fmtDate(d: string) {
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

export default function ThemesManager({ initial, today }: { initial: SeasonalConfig; today: string }) {
  const [config, setConfig] = useState<SeasonalConfig>(initial);
  const [saved, setSaved] = useState<SeasonalConfig>(initial);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  const theme = getTheme(config.themeId) ?? THEMES[0];
  const opts: ThemeOptions = config.options[theme.id] ?? defaultOptions(theme);
  const dirty = JSON.stringify(config) !== JSON.stringify(saved);

  const setOpts = (patch: Partial<ThemeOptions>) =>
    setConfig((c) => ({ ...c, options: { ...c.options, [theme.id]: { ...opts, ...patch } } }));
  const setEffect = (key: string, v: boolean) => setOpts({ effects: { ...opts.effects, [key]: v } });
  const setBanner = (patch: Partial<ThemeOptions['banner']>) => setOpts({ banner: { ...opts.banner, ...patch } });

  const liveNow = resolveActiveTheme(saved, new Date());
  const savedEnabledButOutOfDates = saved.enabled && saved.scheduleEnabled && !liveNow;

  /* ---------------------------------- Aperçu ---------------------------------- */
  const [page, setPage] = useState('/');
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [withTheme, setWithTheme] = useState(true);
  const [full, setFull] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [boxW, setBoxW] = useState(760);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBoxW(el.clientWidth));
    ro.observe(el);
    setBoxW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const previewTheme = useMemo(
    () => (withTheme ? { themeId: theme.id, options: opts } : null),
    [withTheme, theme.id, opts],
  );

  const post = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage({ type: 'rmp-theme', theme: previewTheme }, window.location.origin);
  }, [previewTheme]);

  useEffect(() => {
    post();
  }, [post]);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin === window.location.origin && e.data?.type === 'rmp-theme-ready') post();
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [post]);

  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setFull(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [full]);

  const devW = device === 'desktop' ? 1280 : 390;
  const devH = device === 'desktop' ? 800 : 780;
  const scale = full ? 1 : Math.min(1, Math.max(0.2, boxW / devW));

  /* ---------------------------------- Actions ---------------------------------- */
  const save = () => {
    setMessage(null);
    startTransition(async () => {
      const res = await saveSeasonalConfig(config);
      if ('error' in res && res.error) {
        setMessage({ type: 'error', text: res.error });
        return;
      }
      if ('config' in res && res.config) {
        setSaved(res.config);
        setConfig(res.config);
      }
      setMessage({
        type: 'ok',
        text: config.enabled
          ? 'Enregistré. Le thème est appliqué : les visiteurs le voient d’ici environ 1 minute.'
          : 'Enregistré en brouillon. Les visiteurs ne voient rien pour l’instant.',
      });
    });
  };

  const recommended = () => setOpts({ effects: defaultOptions(theme).effects, intensity: 'normal' });
  const allOff = () => setOpts({ effects: Object.fromEntries(theme.effects.map((e) => [e.key, false])) });

  const visibleEffects = effectsForStyle(theme, opts.style);
  const activeCount = visibleEffects.filter((e) => opts.effects[e.key]).length;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,460px)_minmax(0,1fr)] items-start">
      {/* ================= Colonne réglages ================= */}
      <div className="space-y-5">
        {/* Statut */}
        <div
          className={`rounded-xl border p-4 ${
            liveNow ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-200'
          }`}
        >
          <p className="font-semibold">
            {liveNow
              ? `🟠 Le thème ${theme.name} est ACTIF sur le site`
              : savedEnabledButOutOfDates
                ? `🕒 Thème ${theme.name} programmé (pas encore / plus visible aujourd’hui)`
                : '⚪ Aucun thème actif : le site est affiché normalement'}
          </p>
          {savedEnabledButOutOfDates && (
            <p className="text-sm text-gray-600 mt-1">
              Il apparaîtra du {fmtDate(saved.start)} au {fmtDate(saved.end)} (aujourd’hui : {fmtDate(today)}).
            </p>
          )}
        </div>

        {/* Choix du thème */}
        <section className="bg-white border border-gray-200 rounded-xl p-4">
          <h2 className="font-semibold mb-3">Thème</h2>
          <div className="grid grid-cols-2 gap-2">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setConfig((c) => ({ ...c, themeId: t.id }))}
                className={`text-left rounded-lg border p-3 transition ${
                  t.id === theme.id ? 'border-orange-400 bg-orange-50 ring-1 ring-orange-300' : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <span className="text-2xl">{t.emoji}</span>
                <span className="block font-medium">{t.name}</span>
                <span className="block text-xs text-gray-500 mt-0.5">{t.tagline}</span>
              </button>
            ))}
            <div className="rounded-lg border border-dashed border-gray-300 p-3 text-xs text-gray-500">
              <span className="text-2xl block">🎄 ❤️ 🛍️</span>
              Bientôt : Noël, Saint-Valentin, Soldes d’été, Black Friday, Rentrée…
            </div>
          </div>
        </section>

        {/* Style */}
        <section className="bg-white border border-gray-200 rounded-xl p-4">
          <h2 className="font-semibold mb-1">Style du thème</h2>
          <p className="text-xs text-gray-500 mb-3">Tu peux basculer à tout moment : l’aperçu change tout de suite.</p>
          <div className="grid gap-2">
            {STYLES.map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setOpts({ style: st.id })}
                className={`text-left rounded-lg border p-3 transition ${
                  opts.style === st.id ? 'border-orange-400 bg-orange-50 ring-1 ring-orange-300' : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <span className="font-medium">{st.emoji} {st.name}</span>
                {st.id === 'premium' && <span className="ml-2 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] text-violet-700">WebGL · haute définition</span>}
                <span className="block text-xs text-gray-500 mt-0.5">{st.description}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Activation */}
        <section className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
          <div className="flex items-start gap-3">
            <Switch checked={config.enabled} onChange={(v) => setConfig((c) => ({ ...c, enabled: v }))} label="Afficher le thème sur le site" />
            <div>
              <p className="font-semibold">Afficher le thème sur le site</p>
              <p className="text-sm text-gray-500">
                {config.enabled
                  ? 'Une fois enregistré, les visiteurs verront le thème.'
                  : 'Brouillon : visible uniquement dans l’aperçu ci-contre.'}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Switch checked={config.scheduleEnabled} onChange={(v) => setConfig((c) => ({ ...c, scheduleEnabled: v }))} label="Programmer automatiquement" />
            <div className="flex-1">
              <p className="font-semibold">Programmation automatique</p>
              <p className="text-sm text-gray-500">Le thème s’affiche et disparaît tout seul aux dates choisies.</p>
              {config.scheduleEnabled && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="text-xs text-gray-600">
                    Du
                    <input type="date" value={config.start} onChange={(e) => setConfig((c) => ({ ...c, start: e.target.value }))} className="mt-0.5 block w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm" />
                  </label>
                  <label className="text-xs text-gray-600">
                    Au (inclus)
                    <input type="date" value={config.end} onChange={(e) => setConfig((c) => ({ ...c, end: e.target.value }))} className="mt-0.5 block w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm" />
                  </label>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Intensité */}
        <section className="bg-white border border-gray-200 rounded-xl p-4">
          <h2 className="font-semibold mb-2">Intensité</h2>
          <div className="grid grid-cols-3 gap-2">
            {INTENSITIES.map((i) => (
              <button
                key={i.id}
                type="button"
                onClick={() => setOpts({ intensity: i.id })}
                className={`rounded-lg border px-2 py-2 text-sm text-center transition ${
                  opts.intensity === i.id ? 'border-orange-400 bg-orange-50 font-semibold' : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                {i.label}
                <span className="block text-[11px] font-normal text-gray-500">{i.hint}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Effets */}
        <section className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h2 className="font-semibold">Effets ({activeCount}/{visibleEffects.length})</h2>
            <div className="flex gap-2 text-xs">
              <button type="button" onClick={recommended} className="text-orange-600 hover:underline">Recommandé</button>
              <button type="button" onClick={allOff} className="text-gray-500 hover:underline">Tout couper</button>
            </div>
          </div>

          {GROUPS.map((g) => {
            const list = visibleEffects.filter((e) => e.group === g.id);
            if (!list.length) return null;
            return (
              <div key={g.id} className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{g.title}</p>
                <p className="text-xs text-gray-400 mb-1">{g.hint}</p>
                <ul className="divide-y divide-gray-100">
                  {list.map((e) => {
                    const prem = opts.style === 'premium' ? e.premium : undefined;
                    const label = prem?.label ?? e.label;
                    const description = prem?.description ?? e.description;
                    return (
                    <li key={e.key} className="flex items-start gap-3 py-2.5">
                      <Switch checked={!!opts.effects[e.key]} onChange={(v) => setEffect(e.key, v)} label={label} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {label}
                          {prem && <span className="ml-2 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-normal text-violet-700">3D</span>}
                          {e.desktopOnly && <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-normal text-gray-500">ordinateur</span>}
                        </p>
                        <p className="text-xs text-gray-500">{description}</p>
                        {e.caution && <p className="text-xs text-amber-700 mt-0.5">⚠️ {e.caution}</p>}
                      </div>
                    </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </section>

        {/* Bandeau */}
        {opts.effects.banner && (
          <section className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <h2 className="font-semibold">Bandeau d’offre</h2>
            <label className="block text-xs text-gray-600">
              Message
              <textarea value={opts.banner.text} maxLength={200} rows={2} onChange={(e) => setBanner({ text: e.target.value })} className="mt-0.5 block w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm" />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs text-gray-600">
                Code promo à afficher (facultatif)
                <input value={opts.banner.code} maxLength={40} placeholder="ex. HALLOWEEN10" onChange={(e) => setBanner({ code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') })} className="mt-0.5 block w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm font-mono" />
              </label>
              <label className="block text-xs text-gray-600">
                Compte à rebours jusqu’au (inclus)
                <input type="date" value={opts.banner.countdownDate} onChange={(e) => e.target.value && setBanner({ countdownDate: e.target.value })} className="mt-0.5 block w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm" />
              </label>
              <label className="block text-xs text-gray-600">
                Texte du bouton
                <input value={opts.banner.ctaLabel} maxLength={40} onChange={(e) => setBanner({ ctaLabel: e.target.value })} className="mt-0.5 block w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm" />
              </label>
              <label className="block text-xs text-gray-600">
                Lien du bouton
                <input value={opts.banner.ctaHref} maxLength={200} onChange={(e) => setBanner({ ctaHref: e.target.value })} className="mt-0.5 block w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm" />
              </label>
            </div>
            <label className="block text-xs text-gray-600">
              Message une fois le compte à rebours terminé
              <input value={opts.banner.countdownDoneText} maxLength={80} onChange={(e) => setBanner({ countdownDoneText: e.target.value })} className="mt-0.5 block w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm" />
            </label>
            <p className="text-xs text-gray-500">
              Un code promo saisi ici s’affiche seulement : crée-le (ou vérifie-le) dans « Codes promo » pour qu’il fonctionne au panier.
            </p>
          </section>
        )}

        <div className="sticky bottom-3 z-10 rounded-xl border border-gray-200 bg-white/95 p-3 shadow-lg backdrop-blur">
          {message && (
            <p className={`mb-2 text-sm ${message.type === 'ok' ? 'text-green-700' : 'text-red-600'}`}>{message.text}</p>
          )}
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={pending || !dirty}
              onClick={save}
              className="flex-1 rounded-lg bg-orange-500 px-4 py-2.5 font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? 'Enregistrement…' : config.enabled ? 'Enregistrer et appliquer au site' : 'Enregistrer (brouillon)'}
            </button>
            {dirty && (
              <button type="button" onClick={() => { setConfig(saved); setMessage(null); }} className="text-sm text-gray-500 hover:underline">
                Annuler
              </button>
            )}
          </div>
          {dirty && <p className="mt-1 text-xs text-amber-700">Modifications non enregistrées.</p>}
        </div>
      </div>

      {/* ================= Colonne aperçu ================= */}
      <div
        className={
          full
            ? 'fixed inset-0 z-[100] flex flex-col gap-3 bg-gray-900/90 p-4'
            : 'xl:sticky xl:top-4 space-y-3'
        }
      >
        <div className={`flex flex-wrap items-center gap-2 ${full ? 'text-white' : ''}`}>
          <h2 className="font-semibold mr-auto">Aperçu en direct</h2>
          <div className="inline-flex overflow-hidden rounded-lg border border-gray-300 bg-white text-sm text-gray-800">
            {(['desktop', 'mobile'] as const).map((d) => (
              <button key={d} type="button" onClick={() => setDevice(d)} className={`px-3 py-1.5 ${device === d ? 'bg-orange-500 text-white' : 'hover:bg-gray-50'}`}>
                {d === 'desktop' ? '🖥️ Ordinateur' : '📱 Mobile'}
              </button>
            ))}
          </div>
          <select
            value={page}
            onChange={(e) => setPage(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-800"
            aria-label="Page à prévisualiser"
          >
            {PAGES.map((p) => (
              <option key={p.href} value={p.href}>{p.label}</option>
            ))}
          </select>
          <button type="button" onClick={() => setWithTheme((v) => !v)} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-800 hover:bg-gray-50">
            {withTheme ? 'Voir sans le thème' : 'Revoir avec le thème'}
          </button>
          <button type="button" onClick={() => setReloadKey((k) => k + 1)} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-800 hover:bg-gray-50">
            ↻ Rejouer
          </button>
          <button type="button" onClick={() => setFull((v) => !v)} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-800 hover:bg-gray-50">
            {full ? '✕ Fermer (Échap)' : '⛶ Plein écran'}
          </button>
        </div>

        <div
          ref={wrapRef}
          className={`${full ? 'flex-1 min-h-0' : ''} flex justify-center overflow-hidden rounded-xl border border-gray-300 ${full ? 'bg-black/40' : 'bg-gray-200'}`}
        >
          <div
            style={full ? { width: '100%', height: '100%' } : { width: devW * scale, height: devH * scale }}
            className={device === 'mobile' && !full ? 'shadow-xl' : ''}
          >
            <iframe
              key={`${reloadKey}-${page}`}
              ref={iframeRef}
              title="Aperçu du site"
              src={`${page}?rmp-theme-preview=1`}
              onLoad={post}
              style={
                full
                  ? { width: '100%', height: '100%', border: 0, background: '#fff' }
                  : { width: devW, height: devH, border: 0, background: '#fff', transform: `scale(${scale})`, transformOrigin: '0 0' }
              }
            />
          </div>
        </div>

        {!full && (
          <p className="text-xs text-gray-500">
            L’aperçu montre le vrai site avec tes réglages du moment, même si le thème n’est pas encore activé. Si une
            fenêtre de cookies s’affiche dans l’aperçu, accepte-la une fois. Un visiteur qui a demandé « réduire les
            animations » à son appareil ne verra qu’un décor fixe (sans mouvement).
          </p>
        )}
      </div>
    </div>
  );
}
