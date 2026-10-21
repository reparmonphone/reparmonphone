// Thèmes saisonniers du site (Halloween, Noël, Soldes...). Ce fichier ne contient QUE des données et
// des fonctions pures (aucun import React / Prisma) : il est utilisé à la fois par l'admin (page
// Thèmes), par la route publique /api/theme et par le composant qui joue les animations.
//
// Pour AJOUTER un nouveau thème plus tard (ex. Noël) :
//   1. ajouter une entrée dans THEMES ci-dessous (id, nom, dates conseillées, liste d'effets) ;
//   2. créer src/components/seasonal/NoelTheme.tsx (même contrat que HalloweenTheme.tsx) ;
//   3. l'ajouter dans la table THEME_COMPONENTS de SeasonalTheme.tsx.
// L'admin, l'aperçu, le stockage et le calendrier s'adaptent tout seuls.

export type ThemeId = 'halloween';

export type EffectDef = {
  key: string;
  label: string;
  description: string;
  /** Activé par défaut quand on découvre le thème */
  defaultOn: boolean;
  /** Regroupement dans l'admin */
  group: 'ambiance' | 'animations' | 'interactif' | 'commerce';
  /** Réservé aux écrans avec souris (inutile sur téléphone) */
  desktopOnly?: boolean;
  /** Effet qui clignote / flashe : désactivé d'office, à activer en connaissance de cause */
  caution?: string;
};

export type Intensity = 'doux' | 'normal' | 'intense';

export type ThemeDef = {
  id: ThemeId;
  name: string;
  emoji: string;
  tagline: string;
  /** Fenêtre conseillée (mois-jour) pour la programmation automatique */
  suggestedStart: string;
  suggestedEnd: string;
  effects: EffectDef[];
  banner: {
    text: string;
    ctaLabel: string;
    ctaHref: string;
    /** Date/heure de fin du compte à rebours (ISO local, sans fuseau) — année calculée automatiquement */
    countdownMonthDay: string;
    countdownDoneText: string;
  };
};

export const THEMES: ThemeDef[] = [
  {
    id: 'halloween',
    name: 'Halloween',
    emoji: '🎃',
    tagline: 'Ambiance nocturne, chauves-souris, brume et citrouilles lumineuses.',
    suggestedStart: '10-15',
    suggestedEnd: '11-02',
    effects: [
      { key: 'vignette', group: 'ambiance', label: 'Lueur nocturne sur les bords', description: 'Liseré orange/violet animé en haut de l’écran et léger voile sombre sur les bords, comme une nuit qui tombe.', defaultOn: true },
      { key: 'fog', group: 'ambiance', label: 'Brume mystérieuse', description: 'Deux couches de brume violette qui dérivent lentement au bas de l’écran.', defaultOn: true },
      { key: 'graveyard', group: 'ambiance', label: 'Cimetière en pied de page', description: 'Silhouette de collines, croix, arbre mort, pleine lune et citrouilles dont la flamme vacille, au-dessus du footer.', defaultOn: true },
      { key: 'favicon', group: 'ambiance', label: 'Icône citrouille dans l’onglet', description: 'Remplace le logo de l’onglet du navigateur par une citrouille pendant l’événement.', defaultOn: true },
      { key: 'bats', group: 'animations', label: 'Chauves-souris', description: 'Des chauves-souris aux ailes battantes traversent l’écran à intervalles irréguliers.', defaultOn: true },
      { key: 'embers', group: 'animations', label: 'Braises et lucioles', description: 'Petites lueurs orange qui montent et scintillent doucement (animation légère, optimisée).', defaultOn: true },
      { key: 'spider', group: 'animations', label: 'Araignée sur son fil', description: 'Une araignée descend du haut de l’écran au bout de son fil, se balance, puis remonte.', defaultOn: true },
      { key: 'webs', group: 'animations', label: 'Toiles d’araignée dans les coins', description: 'Toiles fines dans les deux coins supérieurs de l’écran.', defaultOn: true },
      { key: 'ghost', group: 'interactif', label: 'Fantôme qui suit la souris', description: 'Un petit fantôme flotte derrière le curseur avec un léger retard.', defaultOn: false, desktopOnly: true },
      { key: 'cursorTrail', group: 'interactif', label: 'Étincelles derrière le curseur', description: 'Traînée d’étincelles orange quand on bouge la souris.', defaultOn: false, desktopOnly: true },
      { key: 'lightning', group: 'interactif', label: 'Éclairs d’orage', description: 'Lueur d’éclair très douce, une fois toutes les 30 à 60 secondes.', defaultOn: false, caution: 'Effet lumineux : à éviter si tu as des visiteurs sensibles aux flashs. Il reste très atténué et rare.' },
      { key: 'banner', group: 'commerce', label: 'Bandeau Halloween + compte à rebours', description: 'Pastille flottante en bas de l’écran : message, compte à rebours jusqu’à Halloween, code promo copiable et bouton vers la boutique.', defaultOn: true },
    ],
    banner: {
      text: 'Ne laissez pas votre écran vous hanter ! Pièces détachées livrées en 24h.',
      ctaLabel: 'Voir la boutique',
      ctaHref: '/boutique',
      countdownMonthDay: '10-31',
      countdownDoneText: 'Joyeux Halloween !',
    },
  },
];

export type BannerConfig = {
  text: string;
  ctaLabel: string;
  ctaHref: string;
  code: string;
  /** Date de fin du compte à rebours, AAAA-MM-JJ (fin de journée, heure de Paris) */
  countdownDate: string;
  countdownDoneText: string;
};

export type ThemeOptions = {
  intensity: Intensity;
  effects: Record<string, boolean>;
  banner: BannerConfig;
};

export type SeasonalConfig = {
  /** Interrupteur principal : le thème est-il visible par les visiteurs ? */
  enabled: boolean;
  themeId: ThemeId;
  /** Programmation automatique : si activée, le thème n'apparaît qu'entre start et end */
  scheduleEnabled: boolean;
  /** AAAA-MM-JJ */
  start: string;
  end: string;
  options: Record<string, ThemeOptions>;
};

export const SETTING_KEY = 'seasonal_theme_config';

export function getTheme(id: string): ThemeDef | undefined {
  return THEMES.find((t) => t.id === id);
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

/** Date du jour à Paris, au format AAAA-MM-JJ */
export function parisToday(now = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Paris',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
    return parts; // en-CA => 2026-10-21
  } catch {
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }
}

export function defaultOptions(theme: ThemeDef, year = new Date().getFullYear()): ThemeOptions {
  const effects: Record<string, boolean> = {};
  for (const e of theme.effects) effects[e.key] = e.defaultOn;
  return {
    intensity: 'normal',
    effects,
    banner: {
      text: theme.banner.text,
      ctaLabel: theme.banner.ctaLabel,
      ctaHref: theme.banner.ctaHref,
      code: '',
      countdownDate: `${year}-${theme.banner.countdownMonthDay}`,
      countdownDoneText: theme.banner.countdownDoneText,
    },
  };
}

export function defaultConfig(year = new Date().getFullYear()): SeasonalConfig {
  const t = THEMES[0];
  return {
    enabled: false,
    themeId: t.id,
    scheduleEnabled: false,
    start: `${year}-${t.suggestedStart}`,
    // Si la fin tombe "avant" le début dans l'année (ex. Noël : 12-01 → 01-05), elle est sur l'année suivante.
    end: `${t.suggestedEnd < t.suggestedStart ? year + 1 : year}-${t.suggestedEnd}`,
    options: { [t.id]: defaultOptions(t, year) },
  };
}

function isDate(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function str(v: unknown, fallback: string, max = 300): string {
  return typeof v === 'string' ? v.slice(0, max) : fallback;
}

/** Relit une config stockée (JSON libre) en la rendant sûre et complète. */
export function normalizeConfig(raw: unknown, year = new Date().getFullYear()): SeasonalConfig {
  const base = defaultConfig(year);
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Record<string, unknown>;
  const themeId = (getTheme(String(r.themeId))?.id ?? base.themeId) as ThemeId;
  const options: Record<string, ThemeOptions> = {};
  for (const t of THEMES) {
    const d = defaultOptions(t, year);
    const saved = ((r.options as Record<string, unknown> | undefined)?.[t.id] ?? {}) as Record<string, unknown>;
    const savedEffects = (saved.effects ?? {}) as Record<string, unknown>;
    const effects: Record<string, boolean> = {};
    for (const e of t.effects) effects[e.key] = typeof savedEffects[e.key] === 'boolean' ? (savedEffects[e.key] as boolean) : d.effects[e.key];
    const sb = (saved.banner ?? {}) as Record<string, unknown>;
    options[t.id] = {
      intensity: saved.intensity === 'doux' || saved.intensity === 'intense' ? saved.intensity : 'normal',
      effects,
      banner: {
        text: str(sb.text, d.banner.text, 200),
        ctaLabel: str(sb.ctaLabel, d.banner.ctaLabel, 40),
        ctaHref: safeHref(str(sb.ctaHref, d.banner.ctaHref, 200), d.banner.ctaHref),
        code: str(sb.code, '', 40).toUpperCase().replace(/[^A-Z0-9_-]/g, ''),
        countdownDate: isDate(sb.countdownDate) ? sb.countdownDate : d.banner.countdownDate,
        countdownDoneText: str(sb.countdownDoneText, d.banner.countdownDoneText, 80),
      },
    };
  }
  return {
    enabled: r.enabled === true,
    themeId,
    scheduleEnabled: r.scheduleEnabled === true,
    start: isDate(r.start) ? r.start : base.start,
    end: isDate(r.end) ? r.end : base.end,
    options,
  };
}

/** Un lien de bandeau doit rester interne (/...) ou https — jamais javascript:. */
export function safeHref(href: string, fallback: string): string {
  const h = href.trim();
  if (h.startsWith('/') && !h.startsWith('//')) return h;
  if (/^https:\/\//i.test(h)) return h;
  return fallback;
}

export type PublicTheme = { themeId: ThemeId; options: ThemeOptions } | null;

/** Ce que voient réellement les visiteurs aujourd'hui (null = aucun thème). */
export function resolveActiveTheme(config: SeasonalConfig, now = new Date()): PublicTheme {
  if (!config.enabled) return null;
  if (config.scheduleEnabled) {
    const today = parisToday(now);
    if (today < config.start || today > config.end) return null;
  }
  const options = config.options[config.themeId];
  if (!options) return null;
  return { themeId: config.themeId, options };
}
