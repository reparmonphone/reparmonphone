import { EXPEDITION_HEURE_LIMITE, EXPEDITION_JOURS, EXPEDIE_JOURS_FERIES } from '@/data/expedition';

// Calcul pur (sans accès base de données) de la promesse d'expédition, utilisé côté navigateur par
// <ShipCountdown>. Tout est calculé à l'heure de Paris, quel que soit le fuseau du visiteur.

const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

type Ymd = { y: number; m: number; d: number };

function parisParts(now: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  // Certains moteurs renvoient « 24 » pour minuit.
  const hour = get('hour') % 24;
  return { y: get('year'), m: get('month'), d: get('day'), hour, minute: get('minute'), second: get('second') };
}

// Dimanche de Pâques (algorithme de Meeus/Jones/Butcher).
function easter(year: number): Ymd {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { y: year, m: month, d: day };
}

function addDays(t: Ymd, n: number): Ymd {
  const dt = new Date(Date.UTC(t.y, t.m - 1, t.d + n));
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

function key(t: Ymd) {
  return `${t.y}-${String(t.m).padStart(2, '0')}-${String(t.d).padStart(2, '0')}`;
}

function weekday(t: Ymd) {
  return new Date(Date.UTC(t.y, t.m - 1, t.d)).getUTCDay();
}

const holidayCache = new Map<number, Set<string>>();
function holidays(year: number) {
  let set = holidayCache.get(year);
  if (!set) {
    const e = easter(year);
    set = new Set(
      [
        { y: year, m: 1, d: 1 },
        { y: year, m: 5, d: 1 },
        { y: year, m: 5, d: 8 },
        { y: year, m: 7, d: 14 },
        { y: year, m: 8, d: 15 },
        { y: year, m: 11, d: 1 },
        { y: year, m: 11, d: 11 },
        { y: year, m: 12, d: 25 },
        addDays(e, 1), // lundi de Pâques
        addDays(e, 39), // Ascension
        addDays(e, 50), // lundi de Pentecôte
      ].map(key),
    );
    holidayCache.set(year, set);
  }
  return set;
}

function isHoliday(t: Ymd) {
  return holidays(t.y).has(key(t));
}

function isDispatchDay(t: Ymd) {
  if (!EXPEDITION_JOURS.includes(weekday(t))) return false;
  if (!EXPEDIE_JOURS_FERIES && isHoliday(t)) return false;
  return true;
}

// Jour de livraison Chronopost 24h : le prochain jour ouvré (ni week-end, ni férié) après l'expédition.
function deliveryDayAfter(t: Ymd): Ymd {
  let cur = addDays(t, 1);
  for (let i = 0; i < 10; i++) {
    const wd = weekday(cur);
    if (wd !== 0 && wd !== 6 && !isHoliday(cur)) return cur;
    cur = addDays(cur, 1);
  }
  return cur;
}

function dayLabel(target: Ymd, today: Ymd) {
  const tomorrow = addDays(today, 1);
  if (key(target) === key(today)) return "aujourd'hui";
  if (key(target) === key(tomorrow)) return 'demain';
  return WEEKDAYS[weekday(target)];
}

export type ShipPromise =
  | { state: 'today'; remainingSeconds: number; deliveryLabel: string }
  | { state: 'later'; dispatchLabel: string; deliveryLabel: string };

export function shipPromise(now: Date = new Date()): ShipPromise {
  const p = parisParts(now);
  const today: Ymd = { y: p.y, m: p.m, d: p.d };
  const secondsOfDay = p.hour * 3600 + p.minute * 60 + p.second;
  const limit = EXPEDITION_HEURE_LIMITE * 3600;

  if (isDispatchDay(today) && secondsOfDay < limit) {
    const delivery = deliveryDayAfter(today);
    return { state: 'today', remainingSeconds: limit - secondsOfDay, deliveryLabel: dayLabel(delivery, today) };
  }

  let dispatch = addDays(today, 1);
  for (let i = 0; i < 14 && !isDispatchDay(dispatch); i++) dispatch = addDays(dispatch, 1);
  const delivery = deliveryDayAfter(dispatch);
  return { state: 'later', dispatchLabel: dayLabel(dispatch, today), deliveryLabel: dayLabel(delivery, today) };
}

export function formatRemaining(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h} h ${String(m).padStart(2, '0')} min`;
  return `${m} min ${String(s).padStart(2, '0')} s`;
}
