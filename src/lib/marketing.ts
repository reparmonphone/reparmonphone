import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { normalizeEmail } from '@/lib/bannedClients';

// ─────────────────────────────────────────────────────────────────────────────
// E-mails commerciaux (relance des inscrits qui n'ont jamais commandé).
// Tout est stocké dans la table clé/valeur SiteSetting : aucune migration de base.
//  - marketing_unsub        : liste des adresses qui se sont désinscrites (jamais re-contactées)
//  - relance_inscrits_sent  : { adresse: date ISO } dernier envoi de la relance, pour ne jamais écrire deux fois de suite
// ─────────────────────────────────────────────────────────────────────────────

export const UNSUB_KEY = 'marketing_unsub';
export const RELANCE_SENT_KEY = 'relance_inscrits_sent';
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.reparmonphone.fr';

function secret(): string {
  const s = process.env.UNSUBSCRIBE_SECRET || process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error('Aucune clé secrète disponible pour signer les liens de désinscription.');
  return s;
}

export function unsubToken(email: string): string {
  return crypto.createHmac('sha256', secret()).update(normalizeEmail(email)).digest('hex').slice(0, 32);
}

export function verifyUnsubToken(email: string, token: string): boolean {
  try {
    const expected = Buffer.from(unsubToken(email));
    const given = Buffer.from(String(token ?? ''));
    return expected.length === given.length && crypto.timingSafeEqual(expected, given);
  } catch {
    return false;
  }
}

export function unsubUrl(email: string): string {
  return `${SITE_URL}/desinscription?e=${encodeURIComponent(email)}&t=${unsubToken(email)}`;
}

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const row = await prisma.siteSetting.findUnique({ where: { key } });
    return row?.value ? (JSON.parse(row.value) as T) : fallback;
  } catch {
    return fallback;
  }
}

async function writeJson(key: string, value: unknown) {
  const v = JSON.stringify(value);
  await prisma.siteSetting.upsert({ where: { key }, update: { value: v }, create: { key, value: v } });
}

export async function loadUnsubscribed(): Promise<Set<string>> {
  const list = await readJson<string[]>(UNSUB_KEY, []);
  return new Set((Array.isArray(list) ? list : []).map((e) => normalizeEmail(e)));
}

export async function addUnsubscribed(email: string) {
  const set = await loadUnsubscribed();
  set.add(normalizeEmail(email));
  await writeJson(UNSUB_KEY, [...set]);
  // Retire aussi l'adresse de la newsletter : une désinscription vaut pour tous les e-mails commerciaux
  try {
    await prisma.newsletterSubscriber.deleteMany({ where: { email: { equals: email.trim(), mode: 'insensitive' } } });
  } catch {
    // sans importance : la liste de désinscription fait foi
  }
}

export async function loadSentLog(): Promise<Record<string, string>> {
  const log = await readJson<Record<string, string>>(RELANCE_SENT_KEY, {});
  return log && typeof log === 'object' && !Array.isArray(log) ? log : {};
}

export async function saveSentLog(log: Record<string, string>) {
  await writeJson(RELANCE_SENT_KEY, log);
}
