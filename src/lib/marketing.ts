import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { normalizeEmail } from '@/lib/bannedClients';
import type { RelancePromo } from '@/lib/relanceEmail';

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

// Jeton signé (HMAC) lié à une adresse ET à un usage : un lien de désinscription ne peut pas servir à ouvrir un ticket, et inversement.
export type TokenPurpose = 'unsub' | 'ticket';

export function unsubToken(email: string, purpose: TokenPurpose = 'unsub'): string {
  const norm = normalizeEmail(email);
  const msg = purpose === 'unsub' ? norm : `${purpose}:${norm}`;
  return crypto.createHmac('sha256', secret()).update(msg).digest('hex').slice(0, 32);
}

export function verifyUnsubToken(email: string, token: string, purpose: TokenPurpose = 'unsub'): boolean {
  try {
    const expected = Buffer.from(unsubToken(email, purpose));
    const given = Buffer.from(String(token ?? ''));
    return expected.length === given.length && crypto.timingSafeEqual(expected, given);
  } catch {
    return false;
  }
}

export function unsubUrl(email: string): string {
  return `${SITE_URL}/desinscription?e=${encodeURIComponent(email)}&t=${unsubToken(email)}`;
}

// Lien personnel du ticket à gratter (page /ticket)
export function ticketUrl(email: string): string {
  return `${SITE_URL}/ticket?e=${encodeURIComponent(email)}&t=${unsubToken(email, 'ticket')}`;
}

// Numéro de ticket affiché (décoratif, propre à chaque adresse)
export function ticketNumber(email: string): string {
  return unsubToken(email, 'ticket').slice(0, 6).toUpperCase();
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

// ───────── Ticket à gratter ─────────
// Le code promo révélé par le ticket est celui choisi dans « Relance inscrits » au dernier envoi.
export const TICKET_CODE_KEY = 'relance_ticket_code';
export const SCRATCH_KEY = 'ticket_scratched'; // { adresse: date ISO du premier grattage }

export async function setTicketCode(code: string) {
  await writeJson(TICKET_CODE_KEY, code);
}
export async function getTicketCode(): Promise<string | null> {
  const v = await readJson<string | null>(TICKET_CODE_KEY, null);
  return typeof v === 'string' && v ? v : null;
}
export async function loadScratchLog(): Promise<Record<string, string>> {
  const log = await readJson<Record<string, string>>(SCRATCH_KEY, {});
  return log && typeof log === 'object' && !Array.isArray(log) ? log : {};
}
export async function markScratched(email: string) {
  const log = await loadScratchLog();
  const k = normalizeEmail(email);
  if (!log[k]) {
    log[k] = new Date().toISOString();
    await writeJson(SCRATCH_KEY, log);
  }
}

// Lit un code promo et le met en forme pour l'e-mail / la page du ticket.
export async function resolvePromo(code: string | null): Promise<{ promo: RelancePromo | null } | { error: string }> {
  const c = (code ?? '').trim().toUpperCase();
  if (!c) return { promo: null };
  const p = await prisma.promoCode.findUnique({ where: { code: c } });
  if (!p) return { error: `Le code « ${c} » n’existe pas. Crée-le d’abord dans « Codes promo ».` };
  if (!p.active) return { error: `Le code « ${c} » est désactivé.` };
  if (p.expiresAt && p.expiresAt.getTime() < Date.now()) return { error: `Le code « ${c} » est expiré.` };
  if (p.maxUses != null && p.usedCount >= p.maxUses) return { error: `Le code « ${c} » a atteint son nombre maximum d’utilisations.` };
  const value = Number(p.value);
  const label = p.type === 'PERCENT' ? `-${value.toString().replace('.', ',')} %` : `-${value.toFixed(2).replace('.', ',').replace(',00', '')} €`;
  const conditions: string[] = [];
  if (p.oncePerCustomer) conditions.push('Utilisable une seule fois par client');
  if (p.minOrderAmount != null) conditions.push(`Dès ${Number(p.minOrderAmount).toFixed(2).replace('.', ',').replace(',00', '')} € d’achat`);
  if (p.nonCumulable) conditions.push('Hors produits déjà en promotion');
  if (p.expiresAt) conditions.push(`Valable jusqu’au ${p.expiresAt.toLocaleDateString('fr-FR')}`);
  return { promo: { code: p.code, label, conditions } };
}
