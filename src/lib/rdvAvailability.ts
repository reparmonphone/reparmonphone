// Disponibilités des rendez-vous : logique partagée entre la page publique /rdv (formulaire), l'API /api/rdv
// (vérification côté serveur) et l'admin (/admin/rdv/disponibilites).

export type RdvPeriodKey = 'DAY' | 'MORNING' | 'AFTERNOON';
export type RdvBlockLite = { date: string | null; weekday: number | null; period: RdvPeriodKey };

// Plages d'heures proposées au client selon le créneau choisi (modifiables ici si tes horaires changent).
export const RDV_MORNING = { label: 'Matin', min: '08:00', max: '11:59', defaultTime: '09:00' };
export const RDV_AFTERNOON = { label: 'Après-midi', min: '12:00', max: '19:00', defaultTime: '14:00' };

export const WEEKDAY_LABELS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

export const PERIOD_LABELS: Record<RdvPeriodKey, string> = {
  DAY: 'Journée entière',
  MORNING: 'Matin',
  AFTERNOON: 'Après-midi',
};

/** Matin si l'heure est avant midi, après-midi sinon. time = "HH:mm". */
export function periodOfTime(time: string): 'MORNING' | 'AFTERNOON' {
  const hour = parseInt(time.slice(0, 2), 10);
  return hour < 12 ? 'MORNING' : 'AFTERNOON';
}

/** Jour de la semaine (0 = dimanche … 6 = samedi) d'une date "AAAA-MM-JJ", sans effet de fuseau horaire. */
export function weekdayOfDate(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Le créneau (matin ou après-midi) d'une date est-il fermé ? */
export function isSlotBlocked(date: string, period: 'MORNING' | 'AFTERNOON', blocks: RdvBlockLite[]): boolean {
  const weekday = weekdayOfDate(date);
  return blocks.some((b) => {
    const matchesDay = b.date === date || (b.date == null && b.weekday === weekday);
    return matchesDay && (b.period === 'DAY' || b.period === period);
  });
}

export function isDateFullyBlocked(date: string, blocks: RdvBlockLite[]): boolean {
  return isSlotBlocked(date, 'MORNING', blocks) && isSlotBlocked(date, 'AFTERNOON', blocks);
}

/** Ajoute n jours à une date "AAAA-MM-JJ". */
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Date du jour en France ("AAAA-MM-JJ"). */
export function todayInParis(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });
}
