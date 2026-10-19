// Mode vacances — logique commune (page publique, admin, API). Aucun accès base de données ici : ce fichier
// est aussi chargé côté navigateur (aperçu de l'admin et pop-up).
import { addDays, todayInParis } from './rdvAvailability';

export type VacationConfig = {
  enabled: boolean; // interrupteur général : désactivé = rien n'est jamais affiché, même pendant les dates
  start: string; // premier jour de vacances "AAAA-MM-JJ"
  end: string; // dernier jour de vacances "AAAA-MM-JJ" (inclus)
  announceDays: number; // nombre de jours avant le départ où l'on prévient les visiteurs (0 = pas de préavis)
  title: string; // titre pendant les vacances
  message: string; // texte (humour) pendant les vacances
  titleBefore: string; // titre pendant la période de préavis
  messageBefore: string; // texte pendant la période de préavis
  orderInfo: string; // précision sur les commandes / expéditions
  showContact: boolean; // affiche l'adresse e-mail de contact
};

export const DEFAULT_VACATION: VacationConfig = {
  enabled: false,
  start: '',
  end: '',
  announceDays: 7,
  title: 'Mode avion activé',
  message:
    'Notre réparateur est parti recharger sa propre batterie. Promis, il n’a emporté aucun tournevis, et aucun écran n’a été cassé pendant la rédaction de ce message.',
  titleBefore: 'Bientôt en vacances',
  messageBefore:
    'Notre batterie affiche 5 % : il est temps de partir la recharger. Un petit coup d’œil sur ce qu’il vous faut avant le départ ?',
  orderInfo: 'Le site reste ouvert : vous pouvez toujours passer commande. Le traitement se faisant à distance, un décalage pouvant aller jusqu’à 24 h est possible. Merci de votre compréhension.',
  showContact: true,
};

export type VacationPhase = 'none' | 'before' | 'during';

/** Ce que reçoit le pop-up (même format pour le site public et pour l'aperçu de l'admin). */
export type VacationPayload = {
  phase: 'before' | 'during';
  start: string;
  end: string;
  returnDate: string; // lendemain du dernier jour
  daysLeft: number; // jours avant le départ (phase "before") ou avant le retour (phase "during")
  percent: number; // « batterie du réparateur »
  title: string;
  message: string;
  orderInfo: string;
  showContact: boolean;
  version: string; // change quand le contenu change : sert à ré-afficher le pop-up aux visiteurs qui l'avaient fermé
};

function dayNumber(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

export function isValidRange(start: string, end: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end) && end >= start;
}

export function getVacationPhase(c: VacationConfig, today: string = todayInParis()): VacationPhase {
  if (!c.enabled || !isValidRange(c.start, c.end)) return 'none';
  if (today > c.end) return 'none';
  if (today >= c.start) return 'during';
  if (c.announceDays > 0 && today >= addDays(c.start, -c.announceDays)) return 'before';
  return 'none';
}

/** Vrai si cette date (RDV) tombe pendant les vacances (interrupteur général activé). */
export function isDuringVacation(c: VacationConfig, date: string) {
  return c.enabled && isValidRange(c.start, c.end) && date >= c.start && date <= c.end;
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

export function buildVacationPayload(
  c: VacationConfig,
  phase: 'before' | 'during',
  today: string = todayInParis()
): VacationPayload {
  const returnDate = addDays(c.end, 1);
  const total = Math.max(1, dayNumber(c.end) - dayNumber(c.start) + 1);
  const elapsed = Math.min(total, Math.max(0, dayNumber(today) - dayNumber(c.start) + 1));
  const percent = phase === 'before' ? 5 : Math.min(99, Math.max(6, Math.round((elapsed / total) * 100)));
  const daysLeft =
    phase === 'before' ? Math.max(0, dayNumber(c.start) - dayNumber(today)) : Math.max(0, dayNumber(returnDate) - dayNumber(today));
  const title = phase === 'before' ? c.titleBefore : c.title;
  const message = phase === 'before' ? c.messageBefore : c.message;
  return {
    phase,
    start: c.start,
    end: c.end,
    returnDate,
    daysLeft,
    percent,
    title,
    message,
    orderInfo: c.orderInfo,
    showContact: c.showContact,
    version: `${phase}-${c.start}-${c.end}-${hash(title + message + c.orderInfo)}`,
  };
}

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

function parts(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  return { y, m: m - 1, d, wd: new Date(Date.UTC(y, m - 1, d)).getUTCDay() };
}

/** "lundi 3 novembre" */
export function formatDayLong(date: string) {
  const p = parts(date);
  return `${WEEKDAYS[p.wd]} ${p.d === 1 ? '1er' : p.d} ${MONTHS[p.m]}`;
}

/** "3 novembre" */
export function formatDayShort(date: string) {
  const p = parts(date);
  return `${p.d === 1 ? '1er' : p.d} ${MONTHS[p.m]}`;
}

/** "du 3 au 17 novembre" / "du 28 octobre au 8 novembre" */
export function formatRange(start: string, end: string) {
  const a = parts(start);
  const b = parts(end);
  if (a.y === b.y && a.m === b.m) return `du ${a.d === 1 ? '1er' : a.d} au ${b.d === 1 ? '1er' : b.d} ${MONTHS[b.m]}`;
  return `du ${formatDayShort(start)} au ${formatDayShort(end)}`;
}
