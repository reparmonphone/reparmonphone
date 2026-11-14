// Pop-up promotionnel d'ouverture du site (ex. proposer un iPhone reconditionné à tous les visiteurs).
// Se règle dans /admin/popup ; la configuration est stockée dans la table site_settings (clé « promo_popup »).
// Rien n'est visible des visiteurs tant que « enabled » est faux.

import { parisToday } from '@/lib/seasonalThemes';

export const SETTING_KEY = 'promo_popup';

export type PromoConfig = {
  enabled: boolean;
  badge: string; // petite étiquette au-dessus du titre (« Reconditionné · Grade AB »)
  title: string;
  text: string; // phrase d'accroche
  bullets: string[]; // jusqu'à 4 points forts
  price: string; // texte libre (« 149 € »)
  oldPrice: string; // prix barré facultatif
  imageUrl: string;
  ctaLabel: string;
  ctaHref: string; // /produit/... ou adresse https complète
  dismissLabel: string;
  delaySeconds: number; // délai avant l'apparition
  repeatDays: number; // 0 = une seule fois par visite ; n = pas de nouvelle apparition avant n jours
  scheduleEnabled: boolean;
  start: string; // AAAA-MM-JJ
  end: string;
};

export const DEFAULT_PROMO: PromoConfig = {
  enabled: false,
  badge: 'Reconditionné · Grade AB',
  title: 'iPhone SE 2020 reconditionné',
  text: 'Un vrai iPhone, testé et garanti, à petit prix.',
  bullets: ['Testé et contrôlé en atelier', 'Garanti', 'Expédié en Chronopost 24h'],
  price: '',
  oldPrice: '',
  imageUrl: '',
  ctaLabel: 'Découvrir ce modèle',
  ctaHref: '',
  dismissLabel: 'Non merci',
  delaySeconds: 4,
  repeatDays: 3,
  scheduleEnabled: false,
  start: '',
  end: '',
};

export type PromoPayload = Pick<
  PromoConfig,
  'badge' | 'title' | 'text' | 'bullets' | 'price' | 'oldPrice' | 'imageUrl' | 'ctaLabel' | 'ctaHref' | 'dismissLabel' | 'delaySeconds' | 'repeatDays'
> & { version: string };

const isDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v: unknown, min: number, max: number, def: number) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : def;
};
// Seules les adresses du site (/...) et https://... sont acceptées : jamais javascript: ni autre schéma.
const safeUrl = (v: unknown) => {
  const s = str(v, 500);
  if (s.startsWith('/') && !s.startsWith('//')) return s;
  if (/^https:\/\//i.test(s)) return s;
  return '';
};

export function normalizeConfig(raw: unknown): PromoConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_PROMO;
  const hasRaw = Object.keys(r).length > 0;
  return {
    enabled: r.enabled === true,
    badge: hasRaw ? str(r.badge, 60) : d.badge,
    title: hasRaw ? str(r.title, 90) : d.title,
    text: hasRaw ? str(r.text, 200) : d.text,
    bullets: Array.isArray(r.bullets)
      ? r.bullets.map((b) => str(b, 70)).filter(Boolean).slice(0, 4)
      : hasRaw
      ? []
      : d.bullets,
    price: str(r.price, 30),
    oldPrice: str(r.oldPrice, 30),
    imageUrl: safeUrl(r.imageUrl),
    ctaLabel: str(r.ctaLabel, 40) || d.ctaLabel,
    ctaHref: safeUrl(r.ctaHref),
    dismissLabel: str(r.dismissLabel, 30) || d.dismissLabel,
    delaySeconds: num(r.delaySeconds, 0, 60, d.delaySeconds),
    repeatDays: num(r.repeatDays, 0, 60, d.repeatDays),
    scheduleEnabled: r.scheduleEnabled === true,
    start: isDate(r.start) ? r.start : '',
    end: isDate(r.end) ? r.end : '',
  };
}

// Petite empreinte du contenu : si tu modifies le pop-up, les visiteurs qui l'avaient fermé le revoient.
function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export function buildPayload(c: PromoConfig): PromoPayload {
  const body = {
    badge: c.badge,
    title: c.title,
    text: c.text,
    bullets: c.bullets,
    price: c.price,
    oldPrice: c.oldPrice,
    imageUrl: c.imageUrl,
    ctaLabel: c.ctaLabel,
    ctaHref: c.ctaHref,
    dismissLabel: c.dismissLabel,
    delaySeconds: c.delaySeconds,
    repeatDays: c.repeatDays,
  };
  return { ...body, version: hash(JSON.stringify(body)) };
}

// Ce que voient les visiteurs : null si désactivé, incomplet, ou hors des dates choisies.
export function resolveActivePromo(c: PromoConfig, today = parisToday()): PromoPayload | null {
  if (!c.enabled || !c.title || !c.ctaHref) return null;
  if (c.scheduleEnabled) {
    if (c.start && today < c.start) return null;
    if (c.end && today > c.end) return null;
  }
  return buildPayload(c);
}
