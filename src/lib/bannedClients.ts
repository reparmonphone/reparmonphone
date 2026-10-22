import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getClientIp } from '@/lib/clientIp';

// ─────────────────────────────────────────────────────────────────────────────
// Liste noire des clients bannis (gérée depuis /admin/bannis et le bouton « Bannir » de
// /admin/utilisateurs). Stockée dans la table clé/valeur SiteSetting : aucune migration de base.
//
// Un client banni est reconnu par N'IMPORTE LAQUELLE de ses informations : compte (id), e-mail,
// téléphone, adresse IP, adresse postale. S'il change d'e-mail, le téléphone ou l'IP le rattrape,
// et inversement.
// ─────────────────────────────────────────────────────────────────────────────

export const BANNED_KEY = 'banned_clients';

export type BanEntry = {
  id: string;
  label: string; // nom affiché dans l'admin (ex. "Bernard ANDRE")
  reason: string;
  createdAt: string; // ISO
  userIds: string[]; // comptes Supabase
  emails: string[]; // normalisés (minuscules, sans +alias)
  phones: string[]; // normalisés (9 derniers chiffres)
  ips: string[];
  addresses: string[]; // adresses normalisées "ligne|code postal"
};

// Le client banni n'est JAMAIS informé de son bannissement : on lui montre une panne banale
// (BAN_MESSAGE) ou, pour les formulaires sans enjeu, un faux succès silencieux (banSilentOk).
export const BAN_MESSAGE = 'Une erreur est survenue. Merci de réessayer dans quelques instants.';

// ───────── normalisation ─────────

export function normalizeEmail(raw: unknown): string {
  const s = String(raw ?? '').trim().toLowerCase();
  const at = s.lastIndexOf('@');
  if (at < 1) return s;
  let local = s.slice(0, at);
  const domain = s.slice(at + 1);
  local = local.split('+')[0]; // jean+test@... = jean@...
  if (domain === 'gmail.com' || domain === 'googlemail.com') local = local.replace(/\./g, '');
  return `${local}@${domain}`;
}

export function normalizePhone(raw: unknown): string {
  const digits = String(raw ?? '').replace(/\D/g, '');
  // On compare sur les 9 derniers chiffres : 06 84 40 17 91 = +33 6 84 40 17 91 = 0033684401791
  return digits.length >= 9 ? digits.slice(-9) : '';
}

export function normalizeIp(raw: unknown): string {
  const s = String(raw ?? '').trim().toLowerCase();
  return s && s !== 'inconnue' && s !== 'unknown' ? s : '';
}

export function normalizeAddress(line1: unknown, zip: unknown): string {
  const l = String(line1 ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
  const z = String(zip ?? '').replace(/\D/g, '');
  return l.length >= 5 && z.length >= 4 ? `${l}|${z}` : '';
}

function uniq<T>(list: T[]): T[] {
  return Array.from(new Set(list));
}

function cleanList(list: unknown, fn: (v: unknown) => string): string[] {
  if (!Array.isArray(list)) return [];
  return uniq(list.map(fn).filter(Boolean));
}

export function normalizeEntry(raw: unknown): BanEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === 'string' && r.id ? r.id : '';
  if (!id) return null;
  return {
    id,
    label: typeof r.label === 'string' ? r.label.slice(0, 120) : '',
    reason: typeof r.reason === 'string' ? r.reason.slice(0, 500) : '',
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : new Date().toISOString(),
    userIds: cleanList(r.userIds, (v) => String(v ?? '').trim()),
    emails: cleanList(r.emails, normalizeEmail),
    phones: cleanList(r.phones, normalizePhone),
    ips: cleanList(r.ips, normalizeIp),
    addresses: cleanList(r.addresses, (v) => String(v ?? '').trim().toLowerCase()),
  };
}

// ───────── lecture / écriture ─────────

let cache: { entries: BanEntry[]; expiresAt: number } | null = null;
const CACHE_MS = 15_000;

export async function loadBanEntries(opts?: { fresh?: boolean }): Promise<BanEntry[]> {
  if (!opts?.fresh && cache && cache.expiresAt > Date.now()) return cache.entries;
  let entries: BanEntry[] = [];
  try {
    const row = await prisma.siteSetting.findUnique({ where: { key: BANNED_KEY } });
    if (row?.value) {
      const parsed = JSON.parse(row.value);
      if (Array.isArray(parsed)) {
        entries = parsed.map(normalizeEntry).filter((e): e is BanEntry => e !== null);
      }
    }
  } catch {
    // base indisponible : on ne bloque personne par erreur
    return cache?.entries ?? [];
  }
  cache = { entries, expiresAt: Date.now() + CACHE_MS };
  return entries;
}

export async function saveBanEntries(entries: BanEntry[]): Promise<void> {
  const value = JSON.stringify(entries);
  await prisma.siteSetting.upsert({
    where: { key: BANNED_KEY },
    update: { value },
    create: { key: BANNED_KEY, value },
  });
  cache = { entries, expiresAt: Date.now() + CACHE_MS };
}

// ───────── détection ─────────

export type BanIdentity = {
  userId?: string | null;
  email?: string | null;
  phone?: string | null;
  ip?: string | null;
  addressLine1?: string | null;
  addressZip?: string | null;
  // adresses supplémentaires (ex. adresse de livraison différente de celle de facturation)
  moreAddresses?: { line1?: string | null; zip?: string | null }[];
};

export function matchBan(entries: BanEntry[], who: BanIdentity): BanEntry | null {
  const email = normalizeEmail(who.email);
  const phone = normalizePhone(who.phone);
  const ip = normalizeIp(who.ip);
  const addresses = [
    normalizeAddress(who.addressLine1, who.addressZip),
    ...(who.moreAddresses ?? []).map((a) => normalizeAddress(a.line1, a.zip)),
  ].filter(Boolean);
  const userId = (who.userId ?? '').trim();

  for (const e of entries) {
    if (userId && e.userIds.includes(userId)) return e;
    if (email && e.emails.includes(email)) return e;
    if (phone && e.phones.includes(phone)) return e;
    if (ip && e.ips.includes(ip)) return e;
    if (addresses.some((a) => e.addresses.includes(a))) return e;
  }
  return null;
}

async function currentUser(): Promise<{ id: string; email: string | null; phone: string | null } | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    return { id: user.id, email: user.email ?? null, phone: typeof meta.phone === 'string' ? meta.phone : null };
  } catch {
    return null;
  }
}

async function runCheck(ip: string | null, extra?: BanIdentity): Promise<BanEntry | null> {
  const entries = await loadBanEntries();
  if (entries.length === 0) return null; // aucun banni : aucun surcoût
  const user = await currentUser();
  // 1) ce que le visiteur a saisi dans le formulaire (+ son IP)
  // 2) son compte connecté, s'il y en a un (il peut saisir un autre e-mail dans le formulaire)
  const hit =
    matchBan(entries, { ...extra, ip }) ??
    (user ? matchBan(entries, { userId: user.id, email: user.email, phone: user.phone }) : null);
  if (hit) {
    console.warn(
      `[BAN] Action bloquée — ${hit.label || hit.id} | ip=${ip ?? '?'} | email=${extra?.email ?? user?.email ?? '?'}`,
    );
  }
  return hit;
}

// Pour les routes API (Request)
export async function checkBanForRequest(req: Request, extra?: BanIdentity): Promise<BanEntry | null> {
  return runCheck(getClientIp(req), extra);
}

// Pour les Server Actions (pas d'objet Request : on lit les en-têtes de la requête en cours)
export async function checkBanForAction(extra?: BanIdentity): Promise<BanEntry | null> {
  let ip: string | null = null;
  try {
    const h = await headers();
    const xff = h.get('x-forwarded-for');
    const raw = (xff ? xff.split(',')[0] : h.get('x-real-ip')) ?? '';
    ip = raw.trim().slice(0, 64) || null;
  } catch {
    ip = null;
  }
  return runCheck(ip, extra);
}

// Réponse « panne banale » (API) : ne révèle pas le bannissement
export function banResponse() {
  return NextResponse.json({ error: BAN_MESSAGE, message: BAN_MESSAGE }, { status: 500 });
}

// Faux succès silencieux (contact, newsletter, alerte stock) : rien n'est enregistré ni transmis
export function banSilentOk() {
  return NextResponse.json({ ok: true });
}

// Réponse « panne banale » (Server Action)
export const BAN_ACTION_ERROR = { error: BAN_MESSAGE } as const;

// ───────── E-mails : jamais d'envoi à un client banni ─────────

type Recipients = string | string[] | undefined | null;

function toList(r: Recipients): string[] {
  if (!r) return [];
  return Array.isArray(r) ? r : [r];
}

function bareEmail(s: string): string {
  const m = s.match(/<([^>]+)>/);
  return (m ? m[1] : s).trim();
}

// Retire les destinataires bannis (to / cc / bcc). `skip` = plus aucun destinataire "to" : ne rien envoyer.
export async function stripBannedRecipients<T extends { to?: Recipients; cc?: Recipients; bcc?: Recipients }>(
  payload: T,
): Promise<{ payload: T; skip: boolean }> {
  const entries = await loadBanEntries();
  if (entries.length === 0) return { payload, skip: false };

  const keep = (r: Recipients) => toList(r).filter((addr) => !matchBan(entries, { email: bareEmail(addr) }));
  const to = keep(payload.to);
  const hadTo = toList(payload.to).length > 0;
  if (hadTo && to.length === 0) {
    console.warn(`[BAN] E-mail non envoyé (destinataire banni) : ${toList(payload.to).join(', ')}`);
    return { payload, skip: true };
  }
  const next = { ...payload } as T;
  if (payload.to) (next as { to?: Recipients }).to = Array.isArray(payload.to) ? to : to[0];
  if (payload.cc) (next as { cc?: Recipients }).cc = keep(payload.cc);
  if (payload.bcc) (next as { bcc?: Recipients }).bcc = keep(payload.bcc);
  return { payload: next, skip: false };
}

export function newBanId(): string {
  return `ban_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}
