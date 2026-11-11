'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import {
  THEMES,
  STYLES,
  getTheme,
  effectsForStyle,
  defaultOptions,
  resolveActiveTheme,
  inMonthDayWindow,
  applyBannerPhase,
  phaseSchedule,
  themeWindow,
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
  { id: 'intense', label: 'Intense', hint: '' },
];

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

function splitMD(md: string): { m: number; d: number } {
  const [m, d] = md.split('-').map(Number);
  return { m: m || 1, d: d || 1 };
}

function joinMD(m: number, d: number): string {
  return `${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Choix « jour + mois » (la date revient chaque année). */
function DayMonth({ value, onChange, label }: { value: string; onChange: (md: string) => void; label: string }) {
  const { m, d } = splitMD(value);
  const cls = 'rounded-lg border border-gray-300 bg-white px-1.5 py-1 text-sm';
  return (
    <span className="inline-flex items-center gap-1" role="group" aria-label={label}>
      <select aria-label={`${label} : jour`} value={d} onChange={(e) => onChange(joinMD(m, Number(e.target.value)))} className={cls}>
        {Array.from({ length: 31 }, (_, i) => i + 1).map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
      <select aria-label={`${label} : mois`} value={m} onChange={(e) => onChange(joinMD(Number(e.target.value), d))} className={cls}>
        {MONTHS.map((name, i) => (
          <option key={name} value={i + 1}>{name}</option>
        ))}
      </select>
    </span>
  );
}

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
  const liveTheme = liveNow ? getTheme(liveNow.themeId) : undefined;
  const savedEnabledButOutOfDates = saved.enabled && (saved.scheduleEnabled || saved.autoCalendar) && !liveNow;
  const todayMD = today.slice(5);
  const todayYear = Number(today.slice(0, 4));
  const calendarTheme = THEMES.find((t) => {
    const o = config.options[t.id] ?? defaultOptions(t);
    const w = themeWindow(t, o, todayYear);
    return inMonthDayWindow(todayMD, w.from, w.to);
  });
  // Opération en étapes (Black Friday) : calendrier de l'année et étape en cours aujourd'hui
  const phased = !!theme.banner.phases && opts.banner.phasesEnabled;
  const schedule = phased ? phaseSchedule(theme, todayYear) : [];
  const currentPhaseKey = schedule.length
    ? ([...schedule].reverse().find((p) => p.start <= today) ?? schedule[0]).def.key
    : null;
  const [previewPhase, setPreviewPhase] = useState<string | null>(null);
  useEffect(() => setPreviewPhase(null), [theme.id]);
  const setPhase = (key: string, patch: Partial<{ text: string; showCode: boolean }>) =>
    setBanner({ phases: opts.banner.phases.map((p) => (p.key === key ? { ...p, ...patch } : p)) });
  const setWindow = (id: string, patch: { from?: string; to?: string }) =>
    setConfig((c) => {
      const t = getTheme(id) ?? THEMES[0];
      const cur = c.options[id] ?? defaultOptions(t);
      return { ...c, options: { ...c.options, [id]: { ...cur, ...patch } } };
    });

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
    () => (withTheme ? { themeId: theme.id, options: applyBannerPhase(theme, opts, today, previewPhase) } : null),
    [withTheme, theme, opts, today, previewPhase],
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
              ? `🟠 Le thème ${liveTheme?.name ?? theme.name} est ACTIF sur le site`
              : savedEnabledButOutOfDates
                ? saved.autoCalendar
                  ? '🕒 Calendrier automatique activé : aucun thème prévu aujourd’hui'
                  : `🕒 Thème ${theme.name} programmé (pas encore / plus visible aujourd’hui)`
                : '⚪ Aucun thème actif : le site est affiché normalement'}
          </p>
          {savedEnabledButOutOfDates && !saved.autoCalendar && (
            <p className="text-sm text-gray-600 mt-1">
              Il apparaîtra du {fmtDate(saved.start)} au {fmtDate(saved.end)} (aujourd’hui : {fmtDate(today)}).
            </p>
          )}
          {saved.enabled && saved.autoCalendar && (
            <p className="text-sm text-gray-600 mt-1">Le site change de thème tout seul selon le calendrier ci-dessous (aujourd’hui : {fmtDate(today)}).</p>
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
              <span className="text-2xl block">☀️ 🎒</span>
              Bientôt : Soldes d’été, Rentrée, Fête des mères…
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
                <span className="font-medium">{st.id === 'classique' ? theme.emoji : st.emoji} {st.name}</span>
                {st.id === 'premium' && <span className="ml-2 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] text-violet-700">{theme.premiumBadge ?? 'WebGL · haute définition'}</span>}
                <span className="block text-xs text-gray-500 mt-0.5">{st.id === 'premium' ? theme.premiumDescription ?? st.description : st.description}</span>
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
            <Switch
              checked={config.autoCalendar}
              onChange={(v) => setConfig((c) => ({ ...c, autoCalendar: v, scheduleEnabled: v ? false : c.scheduleEnabled }))}
              label="Calendrier automatique de l’année"
            />
            <div className="flex-1">
              <p className="font-semibold">Calendrier automatique de l’année</p>
              <p className="text-sm text-gray-500">
                Le site change de thème tout seul chaque année (Halloween, Black Friday, Noël…). Chaque thème garde les réglages que tu as enregistrés pour lui.
              </p>
              {config.autoCalendar && (
                <div className="mt-3 space-y-2">
                  {THEMES.map((t) => {
                    const o = config.options[t.id] ?? defaultOptions(t);
                    return (
                      <div key={t.id} className={`rounded-lg border p-2 ${calendarTheme?.id === t.id ? 'border-orange-300 bg-orange-50' : 'border-gray-200'}`}>
                        <p className="text-sm font-medium">
                          {t.emoji} {t.name}
                          {calendarTheme?.id === t.id && <span className="ml-2 rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-normal text-orange-700">aujourd’hui</span>}
                        </p>
                        {t.banner.phases && o.banner.phasesEnabled ? (
                          <p className="mt-1 text-xs text-gray-600">
                            {(() => {
                              const sch = phaseSchedule(t, todayYear);
                              return sch.length
                                ? `Du ${fmtDate(sch[0].start)} au ${fmtDate(sch[sch.length - 1].end)} : dates calculées d’après le Black Friday (étapes ci-dessous).`
                                : '';
                            })()}
                          </p>
                        ) : (
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-600">
                            <span>du</span>
                            <DayMonth value={o.from} onChange={(md) => setWindow(t.id, { from: md })} label={`${t.name} début`} />
                            <span>au</span>
                            <DayMonth value={o.to} onChange={(md) => setWindow(t.id, { to: md })} label={`${t.name} fin`} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <p className="text-xs text-gray-500">
                    En dehors de ces dates, le site est affiché normalement. Ne fais pas se chevaucher deux thèmes : c’est le premier de la liste qui gagne.
                    Choisis un thème plus haut pour régler et prévisualiser ses effets.
                  </p>
                </div>
              )}
            </div>
          </div>

          {!config.autoCalendar && (
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
          )}
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
                <span className="block text-[11px] font-normal text-gray-500">{i.id === 'intense' ? theme.intensityHint : i.hint}</span>
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
                          {prem && <span className="ml-2 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-normal text-violet-700">{theme.id === 'halloween' ? '3D' : 'HD'}</span>}
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
            {theme.banner.phases && (
              <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <div className="flex items-start gap-3">
                  <Switch
                    checked={opts.banner.phasesEnabled}
                    onChange={(v) => setBanner({ phasesEnabled: v })}
                    label="Opération en plusieurs étapes"
                  />
                  <div>
                    <p className="text-sm font-semibold">Opération en plusieurs étapes</p>
                    <p className="text-xs text-gray-600">
                      Le bandeau change tout seul : teasing, avant-première, jour J, Cyber Monday. Les dates se recalculent chaque année d’après le Black Friday.
                    </p>
                  </div>
                </div>
                {phased && (
                  <ul className="space-y-2">
                    {schedule.map(({ def, start, end }) => {
                      const cfg = opts.banner.phases.find((p) => p.key === def.key) ?? { key: def.key, text: def.text, showCode: def.showCode };
                      return (
                        <li key={def.key} className={`rounded-lg border bg-white p-2 ${currentPhaseKey === def.key ? 'border-orange-300' : 'border-gray-200'}`}>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-medium">
                              {def.label}
                              <span className="ml-2 text-xs font-normal text-gray-500">
                                {start === end ? fmtDate(start) : `du ${fmtDate(start)} au ${fmtDate(end)}`}
                              </span>
                              {currentPhaseKey === def.key && (
                                <span className="ml-2 rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-normal text-orange-700">aujourd’hui</span>
                              )}
                            </p>
                            <button
                              type="button"
                              onClick={() => setPreviewPhase(def.key)}
                              className={`rounded border px-2 py-0.5 text-xs ${previewPhase === def.key ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                            >
                              Voir dans l’aperçu
                            </button>
                          </div>
                          <textarea
                            value={cfg.text}
                            maxLength={200}
                            rows={2}
                            onChange={(e) => setPhase(def.key, { text: e.target.value })}
                            className="mt-1 block w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                          />
                          <label className="mt-1 flex items-center gap-2 text-xs text-gray-600">
                            <input type="checkbox" checked={cfg.showCode} onChange={(e) => setPhase(def.key, { showCode: e.target.checked })} />
                            Afficher le code promo à cette étape
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {phased && (
                  <p className="text-xs text-gray-600">
                    Pense à annoncer ta réduction dans le texte (ex. « -10 % sur tout le site ») : le bandeau n’affiche aucun chiffre tant que tu ne l’écris pas.
                  </p>
                )}
              </div>
            )}
            {!phased && (
              <label className="block text-xs text-gray-600">
                Message
                <textarea value={opts.banner.text} maxLength={200} rows={2} onChange={(e) => setBanner({ text: e.target.value })} className="mt-0.5 block w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm" />
              </label>
            )}
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs text-gray-600">
                Code promo à afficher (facultatif)
                <input value={opts.banner.code} maxLength={40} placeholder={`ex. ${theme.codeExample}`} onChange={(e) => setBanner({ code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') })} className="mt-0.5 block w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm font-mono" />
              </label>
              {!phased && (
                <label className="block text-xs text-gray-600">
                  Compte à rebours jusqu’au (inclus)
                  <input type="date" value={opts.banner.countdownDate} onChange={(e) => e.target.value && setBanner({ countdownDate: e.target.value })} className="mt-0.5 block w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm" />
                </label>
              )}
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
