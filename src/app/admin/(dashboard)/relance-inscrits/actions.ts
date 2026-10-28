'use server';

import { prisma } from '@/lib/prisma';
import { requireAdminUser } from '@/lib/supabase-server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getResendClient } from '@/lib/resend';
import { loadBanEntries, matchBan, normalizeEmail } from '@/lib/bannedClients';
import { loadUnsubscribed, loadSentLog, saveSentLog, unsubUrl, ticketUrl, ticketNumber, setTicketCode, loadScratchLog, loadOpenLog, loadClickLog, openPixelUrl, phoneKey, resolvePromo, SITE_URL } from '@/lib/marketing';
import { buildRelanceEmail, type RelancePromo } from '@/lib/relanceEmail';

const FROM = process.env.RESEND_FROM_EMAIL ?? 'ReparMonPhone <contact@reparmonphone.fr>';
const BATCH = 10; // petits lots : reste sous la limite de durée Vercel et le débit d'envoi de Resend
const RESEND_AFTER_DAYS = 60; // une même personne n'est jamais relancée deux fois en moins de 60 jours
const BUYER_STATUSES = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'REFUNDED'] as const;

type Candidate = { email: string; firstName: string };

// Une ligne par inscrit sans commande, avec son état vis-à-vis de la relance
export type RelanceRow = {
  email: string;
  name: string;
  createdAt: string | null;
  consent: boolean;
  sentAt: string | null; // dernière relance envoyée (ISO), null = jamais
  scratchedAt: string | null; // ticket gratté par le client (ISO), null = pas encore
  openedAt: string | null; // e-mail ouvert (1re fois, ISO) : pixel, ou déduit d'un clic / grattage
  openCount: number; // nombre d'ouvertures enregistrées
  clickedAt: string | null; // a cliqué dans l'e-mail (page du ticket visitée), ISO
  status: 'eligible' | 'recent' | 'noConsent' | 'unsubscribed' | 'banned' | 'duplicate';
};

export type RelanceStats = {
  totalUsers: number;
  buyers: number; // ont déjà commandé (exclus)
  noOrder: number; // inscrits sans aucune commande payée
  eligible: number; // consentants, joignables, pas déjà relancés récemment
  noConsent: number; // pas de consentement : jamais contactés
  unsubscribed: number;
  banned: number;
  duplicates: number; // même téléphone qu'un client ou qu'un autre inscrit : un seul ticket par personne
  alreadySent: number;
  // Suivi des envois (parmi les inscrits sans commande qui ont reçu la relance)
  sent: number;
  opened: number;
  clicked: number;
  scratched: number;
};

async function loadAllUsers() {
  const admin = createSupabaseAdminClient();
  // Type local volontairement simple (indépendant de la version de supabase-js)
  const users: {
    id: string;
    email?: string;
    created_at?: string;
    banned_until?: string | null;
    user_metadata?: Record<string, unknown>;
  }[] = [];
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    users.push(...data.users);
    if (data.users.length < 1000) break;
  }
  return users;
}

async function compute(): Promise<{ stats: RelanceStats; eligible: Candidate[]; rows: RelanceRow[] }> {
  const [users, orders, newsletter, bans, unsub, sentLog, scratchLog, openLog, clickLog] = await Promise.all([
    loadAllUsers(),
    prisma.order.findMany({
      where: { status: { in: [...BUYER_STATUSES] } },
      select: { userId: true, customerEmail: true, customerPhone: true },
    }),
    prisma.newsletterSubscriber.findMany({ select: { email: true } }),
    loadBanEntries({ fresh: true }),
    loadUnsubscribed(),
    loadSentLog(),
    loadScratchLog(),
    loadOpenLog(),
    loadClickLog(),
  ]);

  const buyerPhones = new Set(orders.map((o: { customerPhone?: string | null }) => phoneKey(o.customerPhone)).filter(Boolean) as string[]);
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
    duplicates: 0,
    alreadySent: 0,
    sent: 0,
    opened: 0,
    clicked: 0,
    scratched: 0,
  };
  const eligible: Candidate[] = [];
  const rows: RelanceRow[] = [];

  // Du plus ancien au plus récent : en cas de doublon (même téléphone), le compte le plus ancien garde son ticket
  users.sort((a: { created_at?: string }, b: { created_at?: string }) => (a.created_at ?? '').localeCompare(b.created_at ?? ''));
  const phonesSeen = new Set<string>(); // téléphones des inscrits déjà joignables (éligibles ou déjà relancés)

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
    const bannedUntil = u.banned_until;
    const optin = meta.marketing_optin === true || (meta.marketing_optin !== false && newsletterEmails.has(norm));
    const name = [meta.first_name, meta.last_name].filter((x) => typeof x === 'string' && x).join(' ');
    const row: RelanceRow = {
      email,
      name,
      createdAt: u.created_at ?? null,
      consent: optin,
      sentAt: sentLog[norm] ?? null,
      scratchedAt: scratchLog[norm] ?? null,
      openedAt: null,
      openCount: openLog[norm]?.count ?? 0,
      clickedAt: clickLog[norm]?.first ?? null,
      status: 'eligible',
    };
    // Ouvert = pixel chargé, OU (images bloquées par le client mail) il a cliqué / gratté : forcément ouvert
    row.openedAt = [openLog[norm]?.first, row.clickedAt, row.scratchedAt].filter((x): x is string => !!x).sort()[0] ?? null;
    if (row.sentAt) {
      stats.sent++;
      if (row.openedAt) stats.opened++;
      if (row.clickedAt || row.scratchedAt) stats.clicked++;
      if (row.scratchedAt) stats.scratched++;
    }
    rows.push(row);
    if ((bannedUntil && new Date(bannedUntil).getTime() > Date.now()) || matchBan(bans, { userId: u.id, email, phone: typeof meta.phone === 'string' ? meta.phone : null })) {
      stats.banned++;
      row.status = 'banned';
      continue;
    }
    if (unsub.has(norm)) {
      stats.unsubscribed++;
      row.status = 'unsubscribed';
      continue;
    }
    // Consentement : case cochée à l'inscription / dans « Mon compte » (le client l'a décochée → false), OU inscription à la newsletter
    if (!optin) {
      stats.noConsent++;
      row.status = 'noConsent';
      continue;
    }
    // Un seul ticket par personne : même téléphone qu'un client existant (réinscription avec une autre adresse) ou qu'un
    // autre inscrit déjà joignable → pas de second ticket. (L'adresse IP n'est utilisée qu'à la commande, pas ici :
    // une box ou un réseau mobile est partagé par plusieurs personnes.)
    const pk = phoneKey(meta.phone);
    if (pk && (buyerPhones.has(pk) || phonesSeen.has(pk))) {
      stats.duplicates++;
      row.status = 'duplicate';
      continue;
    }
    if (pk) phonesSeen.add(pk);
    const last = sentLog[norm];
    if (last && new Date(last).getTime() > sinceMs) {
      stats.alreadySent++;
      row.status = 'recent';
      continue;
    }
    stats.eligible++;
    eligible.push({ email, firstName: typeof meta.first_name === 'string' ? meta.first_name : '' });
  }
  return { stats, eligible, rows };
}

export async function getRelanceData(): Promise<{ stats: RelanceStats; rows: RelanceRow[] } | { error: string }> {
  await requireAdminUser();
  try {
    const { stats, rows } = await compute();
    // À envoyer d'abord, puis déjà envoyés (les plus récents en premier), puis le reste
    const rank = (r: RelanceRow) => (r.status === 'eligible' ? 0 : r.status === 'recent' ? 1 : 2);
    rows.sort((a, b) => rank(a) - rank(b) || (b.sentAt ?? '').localeCompare(a.sentAt ?? '') || (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
    return { stats, rows };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur de chargement.' };
  }
}

// Envoi individuel (bouton « Envoyer » / « Renvoyer » d'une ligne). Même garde-fous que l'envoi groupé :
// consentement, désinscription, bannissement — sauf le délai de 60 jours, que l'admin peut passer volontairement.
export async function sendRelanceToOne(code: string | null, email: string, variant = 0): Promise<{ ok: true; sentAt: string } | { error: string }> {
  await requireAdminUser();
  const r = await resolvePromo(code);
  if ('error' in r) return r;
  let rows: RelanceRow[];
  try {
    rows = (await compute()).rows;
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur de chargement.' };
  }
  const row = rows.find((x) => normalizeEmail(x.email) === normalizeEmail(email));
  if (!row) return { error: 'Inscrit introuvable (ou il a déjà commandé).' };
  if (row.status === 'banned') return { error: 'Cet inscrit ne peut pas être contacté.' };
  if (row.status === 'unsubscribed') return { error: 'Cet inscrit s’est désinscrit des e-mails promotionnels.' };
  if (row.status === 'duplicate') return { error: 'Même numéro de téléphone qu’un client ou qu’un autre inscrit : un seul ticket par personne.' };
  if (row.status === 'noConsent') return { error: 'Cet inscrit n’a pas accepté de recevoir des offres.' };
  try {
    await sendOne({ email: row.email, firstName: row.name.split(' ')[0] ?? '' }, r.promo, variant);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur lors de l'envoi." };
  }
  const log = await loadSentLog();
  const sentAt = new Date().toISOString();
  log[normalizeEmail(row.email)] = sentAt;
  await saveSentLog(log);
  return { ok: true, sentAt };
}

export async function previewRelanceEmail(code: string | null, variant = 0): Promise<{ subject: string; html: string } | { error: string }> {
  await requireAdminUser();
  const r = await resolvePromo(code);
  if ('error' in r) return r;
  const mail = buildRelanceEmail({
    firstName: 'Marie',
    siteUrl: SITE_URL,
    promo: r.promo,
    unsubscribeUrl: `${SITE_URL}/desinscription`,
    ticketUrl: `${SITE_URL}/ticket`,
    ticketNumber: 'A1B2C3',
    subjectVariant: variant,
  });
  return { subject: mail.subject, html: mail.html };
}

async function sendOne(c: Candidate, promo: RelancePromo | null, variant: number, to?: string) {
  const resend = getResendClient();
  if (!resend) throw new Error("Envoi d'e-mail non configuré (RESEND_API_KEY manquante).");
  const url = unsubUrl(c.email);
  // Le ticket révèle le code choisi ici : on le mémorise pour la page /ticket
  if (promo) await setTicketCode(promo.code);
  const mail = buildRelanceEmail({
    firstName: c.firstName,
    siteUrl: SITE_URL,
    promo,
    unsubscribeUrl: url,
    ticketUrl: ticketUrl(c.email),
    ticketNumber: ticketNumber(c.email),
    subjectVariant: variant,
    openPixelUrl: openPixelUrl(c.email),
  });
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

export async function sendRelanceTest(code: string | null, to: string, firstName = 'Marie', variant = 0): Promise<{ ok: true } | { error: string }> {
  await requireAdminUser();
  const email = to.trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: 'Adresse e-mail invalide.' };
  const r = await resolvePromo(code);
  if ('error' in r) return r;
  try {
    await sendOne({ email, firstName: firstName.trim().slice(0, 40) }, r.promo, variant, email);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur lors de l'envoi." };
  }
}

// Envoie un lot de 10 relances. Le bouton côté admin rappelle cette action en boucle jusqu'à ce qu'il n'en reste plus.
// skipEmails = adresses déjà en échec pendant cette session (évite de boucler sur la même).
export async function sendRelanceBatch(
  code: string | null,
  skipEmails: string[] = [],
  variant = 0
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
      await sendOne(c, r.promo, variant);
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
