// Thèmes saisonniers du site (Halloween, Noël, Soldes...). Ce fichier ne contient QUE des données et
// des fonctions pures (aucun import React / Prisma) : il est utilisé à la fois par l'admin (page
// Thèmes), par la route publique /api/theme et par le composant qui joue les animations.
//
// Pour AJOUTER un nouveau thème plus tard :
//   1. ajouter son id dans ThemeId et une entrée dans THEMES ci-dessous (nom, dates conseillées, effets) ;
//   2. soit créer un composant dédié (comme HalloweenTheme.tsx), soit ajouter une scène dans
//      FestiveTheme.tsx (Black Friday, Noël, Nouvel An, Saint-Valentin) ;
//   3. l'ajouter dans la table THEME_COMPONENTS de SeasonalTheme.tsx.
// L'admin, l'aperçu, le stockage et le calendrier s'adaptent tout seuls.
// L'ORDRE de THEMES est l'ordre de l'année : le calendrier automatique le parcourt de haut en bas.

export type ThemeId = 'halloween' | 'blackfriday' | 'noel' | 'nouvelan' | 'valentin';

/** Deux rendus par thème : Classique (illustré 2D, léger) et Premium (3D temps réel WebGL). */
export type StyleId = 'classique' | 'premium';

export const STYLES: { id: StyleId; name: string; emoji: string; description: string }[] = [
  {
    id: 'classique',
    name: 'Classique',
    emoji: '🦇',
    description: 'Décor illustré et animé en 2D. Léger et rapide sur tous les appareils.',
  },
  {
    id: 'premium',
    name: 'Premium 3D',
    emoji: '✨',
    description:
      'Vrai rendu 3D temps réel en haute définition (écrans 4K / Retina) : brume volumétrique, chauves-souris et citrouilles en 3D, braises avec profondeur, relief à la souris. Un peu plus gourmand : sur un appareil qui ne le supporte pas, le visiteur voit automatiquement le style Classique.',
  },
];

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
  /** Si renseigné, l'effet n'existe que pour ces styles (ex. citrouille 3D = Premium seulement) */
  styles?: StyleId[];
  /** Libellé / description alternatifs quand le style Premium est choisi */
  premium?: { label?: string; description: string };
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
  /** Texte alternatif du style Premium (sinon celui de STYLES) */
  premiumDescription?: string;
  /** Pastille affichée sur le style Premium dans l'admin */
  premiumBadge?: string;
  /** Aide sous « Intense » */
  intensityHint: string;
  /** Exemple de code promo dans le bandeau */
  codeExample: string;
  effects: EffectDef[];
  banner: {
    text: string;
    ctaLabel: string;
    ctaHref: string;
    /** Fin du compte à rebours : « MM-JJ » (année calculée automatiquement) ou « blackfriday » (4e vendredi de novembre) */
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
    premiumBadge: 'WebGL · haute définition',
    intensityHint: 'Plus de chauves-souris et de braises',
    codeExample: 'HALLOWEEN10',
    effects: [
      { key: 'vignette', group: 'ambiance', label: 'Lueur nocturne sur les bords', description: 'Liseré orange/violet animé en haut de l’écran et léger voile sombre sur les bords, comme une nuit qui tombe.', defaultOn: true },
      { key: 'fog', group: 'ambiance', label: 'Brume mystérieuse', description: 'Deux couches de brume violette qui dérivent lentement au bas de l’écran.', defaultOn: true,
        premium: { label: 'Brume volumétrique', description: 'Brume calculée en temps réel par la carte graphique : elle ondule, se déforme et réagit à la souris, avec une lueur orange venue du bas.' } },
      { key: 'graveyard', group: 'ambiance', label: 'Cimetière en pied de page', description: 'Silhouette de collines, croix, arbre mort, pleine lune et citrouilles dont la flamme vacille, au-dessus du footer.', defaultOn: true,
        premium: { description: 'Collines, croix, arbre mort et pleine lune avec rayons de lune qui tournent lentement et brume rampante, au-dessus du footer.' } },
      { key: 'favicon', group: 'ambiance', label: 'Icône citrouille dans l’onglet', description: 'Remplace le logo de l’onglet du navigateur par une citrouille pendant l’événement.', defaultOn: true },
      { key: 'bats', group: 'animations', label: 'Chauves-souris', description: 'Des chauves-souris aux ailes battantes traversent l’écran à intervalles irréguliers.', defaultOn: true,
        premium: { label: 'Chauves-souris 3D', description: 'Chauves-souris modélisées en 3D, aux ailes articulées, qui passent à des profondeurs différentes (certaines frôlent l’écran) avec un éclairage réaliste.' } },
      { key: 'embers', group: 'animations', label: 'Braises et lucioles', description: 'Petites lueurs orange qui montent et scintillent doucement (animation légère, optimisée).', defaultOn: true,
        premium: { label: 'Braises 3D', description: 'Centaines de braises en profondeur : nettes au premier plan, floues au loin, qui tourbillonnent et se décalent avec le relief.' } },
      { key: 'swarm', group: 'animations', styles: ['premium'], label: 'Envolée de chauves-souris à l’arrivée', description: 'Une volée de chauves-souris 3D jaillit en bas de l’écran quand le visiteur arrive (une seule fois par visite).', defaultOn: true },
      { key: 'pumpkins3d', group: 'animations', styles: ['premium'], label: 'Citrouilles 3D sur la colline', description: 'De vraies citrouilles en 3D, à la flamme vacillante, qui tournent doucement vers la souris dans le cimetière du pied de page.', defaultOn: true },
      { key: 'pumpkinHero', group: 'animations', styles: ['premium'], label: 'Citrouille 3D flottante', description: 'Une grosse citrouille 3D lumineuse flotte en bas à gauche de l’écran et te suit du regard (grands écrans seulement).', defaultOn: true, desktopOnly: true },
      { key: 'spider', group: 'animations', label: 'Araignée sur son fil', description: 'Une araignée descend du haut de l’écran au bout de son fil, se balance, puis remonte.', defaultOn: true },
      { key: 'webs', group: 'animations', label: 'Toiles d’araignée dans les coins', description: 'Toiles fines dans les deux coins supérieurs de l’écran.', defaultOn: true },
      { key: 'parallax', group: 'interactif', styles: ['premium'], label: 'Relief au mouvement de la souris', description: 'La brume, les braises et les chauves-souris se décalent légèrement selon la souris : effet de profondeur.', defaultOn: true, desktopOnly: true },
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

  /* ------------------------------ BLACK FRIDAY ------------------------------ */
  {
    id: 'blackfriday',
    name: 'Black Friday',
    emoji: '🛍️',
    tagline: 'Noir et or, poussière d’or, étiquette qui se balance, reflets dorés.',
    suggestedStart: '11-20',
    suggestedEnd: '11-30',
    premiumBadge: 'Haute définition',
    premiumDescription:
      'Rendu haute définition (écrans 4K / Retina) : poussière d’or en profondeur, projecteurs qui balaient la page, lumières floues et relief à la souris. Un peu plus gourmand ; sans animations possibles chez le visiteur, il voit le style Classique.',
    intensityHint: 'Plus de paillettes dorées',
    codeExample: 'BLACKFRIDAY',
    effects: [
      { key: 'vignette', group: 'ambiance', label: 'Lueur dorée sur les bords', description: 'Liseré doré animé en haut de l’écran et léger voile sombre sur les bords, comme une vitrine de nuit.', defaultOn: true },
      { key: 'shine', group: 'ambiance', label: 'Reflet doré qui balaie la page', description: 'Un reflet lumineux très discret traverse l’écran de temps en temps, comme sur une vitrine.', defaultOn: true },
      { key: 'scene', group: 'ambiance', label: 'Sacs shopping en pied de page', description: 'Silhouette de sacs de shopping et lueur dorée au-dessus du footer.', defaultOn: true },
      { key: 'favicon', group: 'ambiance', label: 'Icône étiquette dans l’onglet', description: 'Remplace le logo de l’onglet du navigateur par une étiquette dorée pendant l’événement.', defaultOn: true },
      { key: 'glitter', group: 'animations', label: 'Poussière d’or', description: 'Paillettes dorées qui scintillent et descendent doucement (animation légère, optimisée).', defaultOn: true,
        premium: { label: 'Poussière d’or en profondeur', description: 'Paillettes dorées sur trois plans : nettes au premier plan, floues au loin, avec scintillement.' } },
      { key: 'tag', group: 'animations', label: 'Étiquette « Black Friday » qui se balance', description: 'Une étiquette dorée descend du haut de l’écran au bout de sa cordelette, se balance, puis remonte.', defaultOn: true },
      { key: 'spotlights', group: 'animations', styles: ['premium'], label: 'Projecteurs de vitrine', description: 'Deux faisceaux lumineux dorés balaient lentement le haut de l’écran.', defaultOn: true },
      { key: 'bokeh', group: 'animations', styles: ['premium'], label: 'Lumières floues dorées', description: 'De grosses bulles de lumière floues dérivent doucement au premier plan (effet photo de nuit).', defaultOn: true },
      { key: 'parallax', group: 'interactif', styles: ['premium'], label: 'Relief au mouvement de la souris', description: 'La poussière d’or et les lumières se décalent légèrement selon la souris : effet de profondeur.', defaultOn: true, desktopOnly: true },
      { key: 'cursorTrail', group: 'interactif', label: 'Étincelles dorées derrière le curseur', description: 'Traînée d’étincelles dorées quand on bouge la souris.', defaultOn: false, desktopOnly: true },
      { key: 'banner', group: 'commerce', label: 'Bandeau Black Friday + compte à rebours', description: 'Pastille flottante en bas de l’écran : message, compte à rebours jusqu’au Black Friday, code promo copiable et bouton vers la boutique.', defaultOn: true },
    ],
    banner: {
      text: 'C’est le Black Friday ! Pièces détachées livrées en 24h.',
      ctaLabel: 'Voir la boutique',
      ctaHref: '/boutique',
      countdownMonthDay: 'blackfriday',
      countdownDoneText: 'Merci d’avoir fait le Black Friday avec nous !',
    },
  },

  /* ---------------------------------- NOËL ---------------------------------- */
  {
    id: 'noel',
    name: 'Noël',
    emoji: '🎄',
    tagline: 'Neige, guirlande lumineuse, village enneigé et traîneau du Père Noël.',
    suggestedStart: '12-01',
    suggestedEnd: '12-26',
    premiumBadge: 'Haute définition',
    premiumDescription:
      'Rendu haute définition (écrans 4K / Retina) : neige sur trois plans avec flocons cristallisés, aurore boréale, lumières chaudes floues et relief à la souris. Un peu plus gourmand ; sans animations possibles chez le visiteur, il voit le style Classique.',
    intensityHint: 'Plus de flocons',
    codeExample: 'NOEL10',
    effects: [
      { key: 'frost', group: 'ambiance', label: 'Givre sur les bords', description: 'Liseré bleu glacé animé en haut de l’écran et léger voile givré sur les bords.', defaultOn: true },
      { key: 'lights', group: 'ambiance', label: 'Guirlande lumineuse en haut de la page', description: 'Fil de petites ampoules multicolores qui scintillent, accroché en haut de la page.', defaultOn: true },
      { key: 'aurora', group: 'ambiance', styles: ['premium'], label: 'Aurore boréale', description: 'Voiles verts et violets très doux qui ondulent en haut de l’écran.', defaultOn: true },
      { key: 'scene', group: 'ambiance', label: 'Village enneigé en pied de page', description: 'Collines de neige, sapins illuminés, maisons aux fenêtres allumées, lune et étoiles au-dessus du footer.', defaultOn: true },
      { key: 'favicon', group: 'ambiance', label: 'Icône sapin dans l’onglet', description: 'Remplace le logo de l’onglet du navigateur par un sapin pendant l’événement.', defaultOn: true },
      { key: 'snow', group: 'animations', label: 'Neige', description: 'Flocons qui tombent doucement, avec un léger vent (animation légère, optimisée).', defaultOn: true,
        premium: { label: 'Neige en profondeur', description: 'Flocons sur trois plans : petits et nets au loin, gros flocons cristallisés et flous au premier plan.' } },
      { key: 'sleigh', group: 'animations', label: 'Traîneau du Père Noël', description: 'Le traîneau et ses rennes traversent le ciel de temps en temps (une fois par minute environ).', defaultOn: true },
      { key: 'bokeh', group: 'animations', styles: ['premium'], label: 'Lumières chaudes floues', description: 'De grosses bulles de lumière dorée et rouge dérivent doucement au premier plan.', defaultOn: true },
      { key: 'parallax', group: 'interactif', styles: ['premium'], label: 'Relief au mouvement de la souris', description: 'La neige et les lumières se décalent légèrement selon la souris : effet de profondeur.', defaultOn: true, desktopOnly: true },
      { key: 'cursorTrail', group: 'interactif', label: 'Flocons derrière le curseur', description: 'Petits flocons scintillants quand on bouge la souris.', defaultOn: false, desktopOnly: true },
      { key: 'banner', group: 'commerce', label: 'Bandeau Noël + compte à rebours', description: 'Pastille flottante en bas de l’écran : message, compte à rebours jusqu’à Noël, code promo copiable et bouton vers la boutique.', defaultOn: true },
    ],
    banner: {
      text: 'Joyeux Noël en avance ! Pièces détachées livrées en 24h pour réparer avant les fêtes.',
      ctaLabel: 'Voir la boutique',
      ctaHref: '/boutique',
      countdownMonthDay: '12-25',
      countdownDoneText: 'Joyeux Noël à tous !',
    },
  },

  /* ----------------------------- NOUVEL AN / SOLDES ----------------------------- */
  {
    id: 'nouvelan',
    name: 'Nouvel An & Soldes d’hiver',
    emoji: '🎆',
    tagline: 'Confettis, feux d’artifice discrets, fanions et skyline de ville en fête.',
    suggestedStart: '12-27',
    suggestedEnd: '01-31',
    premiumBadge: 'Haute définition',
    premiumDescription:
      'Rendu haute définition (écrans 4K / Retina) : feux d’artifice plus riches avec double couronne, lumières dorées floues et relief à la souris. Un peu plus gourmand ; sans animations possibles chez le visiteur, il voit le style Classique.',
    intensityHint: 'Plus de confettis et de feux',
    codeExample: 'SOLDES10',
    effects: [
      { key: 'glow', group: 'ambiance', label: 'Lueur de fête', description: 'Liseré violet et or animé en haut de l’écran et léger voile nocturne sur les bords.', defaultOn: true },
      { key: 'pennants', group: 'ambiance', label: 'Fanions en haut de la page', description: 'Fil de petits fanions colorés accroché en haut de la page.', defaultOn: true },
      { key: 'scene', group: 'ambiance', label: 'Skyline de ville en pied de page', description: 'Silhouette de ville aux fenêtres allumées, étoiles et bulles de champagne au-dessus du footer.', defaultOn: true },
      { key: 'favicon', group: 'ambiance', label: 'Icône étoile dans l’onglet', description: 'Remplace le logo de l’onglet du navigateur par une étoile de fête pendant l’événement.', defaultOn: true },
      { key: 'confetti', group: 'animations', label: 'Confettis', description: 'Confettis colorés qui tournoient en tombant (animation légère, optimisée).', defaultOn: true },
      { key: 'fireworks', group: 'animations', label: 'Feux d’artifice discrets', description: 'Bouquets lumineux doux dans le haut de l’écran, jamais plus d’un toutes les 1,5 seconde.', defaultOn: true,
        premium: { label: 'Feux d’artifice haute définition', description: 'Bouquets plus riches avec double couronne et lueur, jamais plus d’un toutes les 1,5 seconde.' } },
      { key: 'bokeh', group: 'animations', styles: ['premium'], label: 'Lumières dorées floues', description: 'De grosses bulles de lumière dorée et violette dérivent doucement au premier plan.', defaultOn: true },
      { key: 'parallax', group: 'interactif', styles: ['premium'], label: 'Relief au mouvement de la souris', description: 'Les confettis et les lumières se décalent légèrement selon la souris : effet de profondeur.', defaultOn: true, desktopOnly: true },
      { key: 'cursorTrail', group: 'interactif', label: 'Confettis derrière le curseur', description: 'Petits confettis colorés quand on bouge la souris.', defaultOn: false, desktopOnly: true },
      { key: 'banner', group: 'commerce', label: 'Bandeau Nouvel An + compte à rebours', description: 'Pastille flottante en bas de l’écran : message, compte à rebours jusqu’au 31 décembre, code promo copiable et bouton vers la boutique.', defaultOn: true },
    ],
    banner: {
      text: 'Bonne année ! Pièces détachées livrées en 24h, toute l’année.',
      ctaLabel: 'Voir la boutique',
      ctaHref: '/boutique',
      countdownMonthDay: '12-31',
      countdownDoneText: 'Bonne année à tous !',
    },
  },

  /* ------------------------------- SAINT-VALENTIN ------------------------------- */
  {
    id: 'valentin',
    name: 'Saint-Valentin',
    emoji: '❤️',
    tagline: 'Cœurs qui montent, pétales de rose, guirlande de cœurs et lueur rose.',
    suggestedStart: '02-01',
    suggestedEnd: '02-15',
    premiumBadge: 'Haute définition',
    premiumDescription:
      'Rendu haute définition (écrans 4K / Retina) : cœurs et pétales sur trois plans, gros cœurs flous au premier plan et relief à la souris. Un peu plus gourmand ; sans animations possibles chez le visiteur, il voit le style Classique.',
    intensityHint: 'Plus de cœurs et de pétales',
    codeExample: 'AMOUR10',
    effects: [
      { key: 'glow', group: 'ambiance', label: 'Lueur rose sur les bords', description: 'Liseré rose animé en haut de l’écran et léger voile rosé sur les bords.', defaultOn: true },
      { key: 'hangingHearts', group: 'ambiance', label: 'Guirlande de cœurs en haut de la page', description: 'Petits cœurs suspendus à un fil, accrochés en haut de la page.', defaultOn: true },
      { key: 'scene', group: 'ambiance', label: 'Collines roses et ballons en pied de page', description: 'Collines douces, ballons en forme de cœur qui montent lentement et étoiles au-dessus du footer.', defaultOn: true },
      { key: 'favicon', group: 'ambiance', label: 'Icône cœur dans l’onglet', description: 'Remplace le logo de l’onglet du navigateur par un cœur pendant l’événement.', defaultOn: true },
      { key: 'hearts', group: 'animations', label: 'Cœurs qui montent', description: 'Cœurs rouges et roses qui flottent vers le haut en se balançant (animation légère, optimisée).', defaultOn: true,
        premium: { label: 'Cœurs en profondeur', description: 'Cœurs sur trois plans : petits et nets au loin, plus gros et flous au premier plan.' } },
      { key: 'petals', group: 'animations', label: 'Pétales de rose', description: 'Pétales qui tombent en tournoyant doucement.', defaultOn: true },
      { key: 'bokeh', group: 'animations', styles: ['premium'], label: 'Gros cœurs flous', description: 'De grosses bulles de lumière rose et rouge dérivent doucement au premier plan.', defaultOn: true },
      { key: 'parallax', group: 'interactif', styles: ['premium'], label: 'Relief au mouvement de la souris', description: 'Les cœurs et les pétales se décalent légèrement selon la souris : effet de profondeur.', defaultOn: true, desktopOnly: true },
      { key: 'cursorTrail', group: 'interactif', label: 'Petits cœurs derrière le curseur', description: 'Petits cœurs qui s’envolent quand on bouge la souris.', defaultOn: false, desktopOnly: true },
      { key: 'banner', group: 'commerce', label: 'Bandeau Saint-Valentin + compte à rebours', description: 'Pastille flottante en bas de l’écran : message, compte à rebours jusqu’au 14 février, code promo copiable et bouton vers la boutique.', defaultOn: true },
    ],
    banner: {
      text: 'Pour la Saint-Valentin, redonne vie à son téléphone ! Pièces livrées en 24h.',
      ctaLabel: 'Voir la boutique',
      ctaHref: '/boutique',
      countdownMonthDay: '02-14',
      countdownDoneText: 'Joyeuse Saint-Valentin !',
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
  style: StyleId;
  intensity: Intensity;
  effects: Record<string, boolean>;
  banner: BannerConfig;
  /** Fenêtre du calendrier automatique, « MM-JJ » (revient chaque année) */
  from: string;
  to: string;
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
  /** Calendrier automatique : le site change de thème tout seul selon les fenêtres « from/to » de chaque thème */
  autoCalendar: boolean;
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

/** Date du Black Friday (4e vendredi de novembre), AAAA-MM-JJ */
export function blackFridayDate(year: number): string {
  const first = new Date(Date.UTC(year, 10, 1)).getUTCDay();
  const firstFriday = ((5 - first + 7) % 7) + 1;
  return `${year}-11-${pad(firstFriday + 21)}`;
}

function countdownFor(theme: ThemeDef, year: number): string {
  return theme.banner.countdownMonthDay === 'blackfriday' ? blackFridayDate(year) : `${year}-${theme.banner.countdownMonthDay}`;
}

export function defaultOptions(theme: ThemeDef, year = new Date().getFullYear()): ThemeOptions {
  const effects: Record<string, boolean> = {};
  for (const e of theme.effects) effects[e.key] = e.defaultOn;
  return {
    style: 'classique',
    intensity: 'normal',
    effects,
    from: theme.suggestedStart,
    to: theme.suggestedEnd,
    banner: {
      text: theme.banner.text,
      ctaLabel: theme.banner.ctaLabel,
      ctaHref: theme.banner.ctaHref,
      code: '',
      countdownDate: countdownFor(theme, year),
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
    // Si la fin tombe "avant" le début dans l'année (ex. Nouvel An : 12-27 → 01-31), elle est sur l'année suivante.
    end: `${t.suggestedEnd < t.suggestedStart ? year + 1 : year}-${t.suggestedEnd}`,
    autoCalendar: false,
    options: Object.fromEntries(THEMES.map((th) => [th.id, defaultOptions(th, year)])),
  };
}

function isDate(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function isMonthDay(v: unknown): v is string {
  return typeof v === 'string' && /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(v);
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
      style: saved.style === 'premium' ? 'premium' : 'classique',
      from: isMonthDay(saved.from) ? saved.from : d.from,
      to: isMonthDay(saved.to) ? saved.to : d.to,
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
    autoCalendar: r.autoCalendar === true,
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

function dayNumber(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

/** « MM-JJ » dans la fenêtre from → to (la fenêtre peut enjamber le 1er janvier, ex. 12-27 → 01-31). */
export function inMonthDayWindow(md: string, from: string, to: string): boolean {
  return from <= to ? md >= from && md <= to : md >= from || md <= to;
}

/** Un compte à rebours resté sur l'année dernière repart tout seul sur la prochaine occurrence. */
export function rollCountdown(theme: ThemeDef, options: ThemeOptions, today: string): ThemeOptions {
  const cd = options.banner.countdownDate;
  if (dayNumber(today) - dayNumber(cd) <= 200) return options;
  const year = Number(today.slice(0, 4));
  const at = (y: number) => (theme.banner.countdownMonthDay === 'blackfriday' ? blackFridayDate(y) : `${y}-${cd.slice(5)}`);
  let next = at(year);
  if (dayNumber(today) - dayNumber(next) > 30) next = at(year + 1);
  return { ...options, banner: { ...options.banner, countdownDate: next } };
}

/** Ce que voient réellement les visiteurs aujourd'hui (null = aucun thème). */
export function resolveActiveTheme(config: SeasonalConfig, now = new Date()): PublicTheme {
  if (!config.enabled) return null;
  const today = parisToday(now);
  let themeId = config.themeId;
  if (config.autoCalendar) {
    const md = today.slice(5);
    const hit = THEMES.find((t) => {
      const o = config.options[t.id];
      return !!o && inMonthDayWindow(md, o.from, o.to);
    });
    if (!hit) return null;
    themeId = hit.id;
  } else if (config.scheduleEnabled) {
    if (today < config.start || today > config.end) return null;
  }
  const options = config.options[themeId];
  const theme = getTheme(themeId);
  if (!options || !theme) return null;
  return { themeId, options: rollCountdown(theme, options, today) };
}

/** Effets visibles dans l'admin / actifs pour le style choisi. */
export function effectsForStyle(theme: ThemeDef, style: StyleId): EffectDef[] {
  return theme.effects.filter((e) => !e.styles || e.styles.includes(style));
}
