'use server';

import { prisma } from '@/lib/prisma';
import { requireAdminUser } from '@/lib/supabase-server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getResendClient } from '@/lib/resend';
import { loadBanEntries, matchBan, normalizeEmail } from '@/lib/bannedClients';
import { loadUnsubscribed, loadSentLog, saveSentLog, unsubUrl, SITE_URL } from '@/lib/marketing';
import { buildRelanceEmail, type RelancePromo } from '@/lib/relanceEmail';

const FROM = process.env.RESEND_FROM_EMAIL ?? 'ReparMonPhone <contact@reparmonphone.fr>';
const BATCH = 10; // petits lots : reste sous la limite de durée Vercel et le débit d'envoi de Resend
const RESEND_AFTER_DAYS = 60; // une même personne n'est jamais relancée deux fois en moins de 60 jours
const BUYER_STATUSES = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'REFUNDED'] as const;

type Candidate = { email: string; firstName: string };

export type RelanceStats = {
  totalUsers: number;
  buyers: number; // ont déjà commandé (exclus)
  noOrder: number; // inscrits sans aucune commande payée
  eligible: number; // consentants, joignables, pas déjà relancés récemment
  noConsent: number; // pas de consentement : jamais contactés
  unsubscribed: number;
  banned: number;
  alreadySent: number;
};

async function loadAllUsers() {
  const admin = createSupabaseAdminClient();
  const users: Awaited<ReturnType<typeof admin.auth.admin.listUsers>>['data']['users'] = [];
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    users.push(...data.users);
    if (data.users.length < 1000) break;
  }
  return users;
}

async function compute(): Promise<{ stats: RelanceStats; eligible: Candidate[] }> {
  const [users, orders, newsletter, bans, unsub, sentLog] = await Promise.all([
    loadAllUsers(),
    prisma.order.findMany({
      where: { status: { in: [...BUYER_STATUSES] } },
      select: { userId: true, customerEmail: true },
    }),
    prisma.newsletterSubscriber.findMany({ select: { email: true } }),
    loadBanEntries({ fresh: true }),
    loadUnsubscribed(),
    loadSentLog(),
  ]);

  const buyerIds = new Set(orders.map((o: { userId: string | null }) => o.userId).filter(Boolean) as string[]);
  const buyerEmails = new Set(orders.map((o: { customerEmail: string }) => normalizeEmail(o.customerEmail)));
  const newsletterEmails = new Set(newsletter.map((n: { email: string }) => normalizeEmail(n.email)));
  const sinceMs = Date.now() - RESEND_AFTER_DAYS * 24 * 3600 * 1000;

  const stats: RelanceStats = {
    totalUsers: users.length,
    buyers: 0,
    noOrder: 0,
    eligible: 0,
    noConsent: 0,
    unsubscribed: 0,
    banned: 0,
    alreadySent: 0,
  };
  const eligible: Candidate[] = [];

  for (const u of users) {
    const email = (u.email ?? '').trim();
    if (!email) continue;
    const norm = normalizeEmail(email);
    if (buyerIds.has(u.id) || buyerEmails.has(norm)) {
      stats.buyers++;
      continue;
    }
    stats.noOrder++;
    const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
    const bannedUntil = (u as { banned_until?: string | null }).banned_until;
    if ((bannedUntil && new Date(bannedUntil).getTime() > Date.now()) || matchBan(bans, { userId: u.id, email, phone: typeof meta.phone === 'string' ? meta.phone : null })) {
      stats.banned++;
      continue;
    }
    if (unsub.has(norm)) {
      stats.unsubscribed++;
      continue;
    }
    // Consentement : case cochée à l'inscription / dans « Mon compte » (le client l'a décochée → false), OU inscription à la newsletter
    const optin = meta.marketing_optin === true || (meta.marketing_optin !== false && newsletterEmails.has(norm));
    if (!optin) {
      stats.noConsent++;
      continue;
    }
    const last = sentLog[norm];
    if (last && new Date(last).getTime() > sinceMs) {
      stats.alreadySent++;
      continue;
    }
    stats.eligible++;
    eligible.push({ email, firstName: typeof meta.first_name === 'string' ? meta.first_name : '' });
  }
  return { stats, eligible };
}

async function resolvePromo(code: string | null): Promise<{ promo: RelancePromo | null } | { error: string }> {
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

export async function getRelanceStats(): Promise<RelanceStats | { error: string }> {
  await requireAdminUser();
  try {
    return (await compute()).stats;
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur de chargement.' };
  }
}

export async function previewRelanceEmail(code: string | null): Promise<{ subject: string; html: string } | { error: string }> {
  await requireAdminUser();
  const r = await resolvePromo(code);
  if ('error' in r) return r;
  const mail = buildRelanceEmail({
    firstName: 'Marie',
    siteUrl: SITE_URL,
    promo: r.promo,
    unsubscribeUrl: `${SITE_URL}/desinscription`,
  });
  return { subject: mail.subject, html: mail.html };
}

async function sendOne(c: Candidate, promo: RelancePromo | null, to?: string) {
  const resend = getResendClient();
  if (!resend) throw new Error("Envoi d'e-mail non configuré (RESEND_API_KEY manquante).");
  const url = unsubUrl(c.email);
  const mail = buildRelanceEmail({ firstName: c.firstName, siteUrl: SITE_URL, promo, unsubscribeUrl: url });
  const res = await resend.emails.send({
    from: FROM,
    to: to ?? c.email,
    subject: to ? `[TEST] ${mail.subject}` : mail.subject,
    html: mail.html,
    text: mail.text,
    headers: { 'List-Unsubscribe': `<${url}>` },
  });
  if (res.error) throw new Error(res.error.message ?? 'Erreur Resend');
}

export async function sendRelanceTest(code: string | null, to: string): Promise<{ ok: true } | { error: string }> {
  await requireAdminUser();
  const email = to.trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: 'Adresse e-mail invalide.' };
  const r = await resolvePromo(code);
  if ('error' in r) return r;
  try {
    await sendOne({ email, firstName: 'Marie' }, r.promo, email);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur lors de l'envoi." };
  }
}

// Envoie un lot de 10 relances. Le bouton côté admin rappelle cette action en boucle jusqu'à ce qu'il n'en reste plus.
// skipEmails = adresses déjà en échec pendant cette session (évite de boucler sur la même).
export async function sendRelanceBatch(
  code: string | null,
  skipEmails: string[] = []
): Promise<{ sent: number; failed: string[]; remaining: number; lastError?: string } | { error: string }> {
  await requireAdminUser();
  const r = await resolvePromo(code);
  if ('error' in r) return r;

  let eligible: Candidate[];
  try {
    eligible = (await compute()).eligible;
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur de chargement.' };
  }
  const skip = new Set(skipEmails.map(normalizeEmail));
  const todo = eligible.filter((c) => !skip.has(normalizeEmail(c.email)));
  const batch = todo.slice(0, BATCH);

  const log = await loadSentLog();
  const failed: string[] = [];
  let sent = 0;
  let lastError: string | undefined;
  for (const c of batch) {
    try {
      await sendOne(c, r.promo);
      log[normalizeEmail(c.email)] = new Date().toISOString();
      sent++;
    } catch (e) {
      failed.push(c.email);
      lastError = e instanceof Error ? e.message : 'Erreur inconnue';
    }
    await new Promise((res) => setTimeout(res, 600)); // Resend : ~2 envois/seconde
  }
  if (sent > 0) await saveSentLog(log);

  return { sent, failed, remaining: Math.max(0, todo.length - batch.length), lastError };
}
