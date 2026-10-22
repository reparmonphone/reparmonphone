'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireAdminUser } from '@/lib/supabase-server';
import {
  loadBanEntries,
  saveBanEntries,
  newBanId,
  normalizeEmail,
  normalizePhone,
  normalizeIp,
  normalizeAddress,
  type BanEntry,
} from '@/lib/bannedClients';

// Un compte banni ne peut plus se connecter (Supabase refuse la session). ~100 ans = définitif.
const SUPABASE_BAN_DURATION = '876000h';

type IdentifierKind = 'email' | 'phone' | 'ip' | 'address' | 'userId';

function emptyEntry(label: string, reason: string): BanEntry {
  return {
    id: newBanId(),
    label,
    reason,
    createdAt: new Date().toISOString(),
    userIds: [],
    emails: [],
    phones: [],
    ips: [],
    addresses: [],
  };
}

function pushUnique(list: string[], value: string) {
  if (value && !list.includes(value)) list.push(value);
}

async function setSupabaseBan(userId: string, banned: boolean) {
  try {
    const supabaseAdmin = createSupabaseAdminClient();
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      ban_duration: banned ? SUPABASE_BAN_DURATION : 'none',
    });
  } catch (e) {
    console.error('Impossible de (dé)bannir le compte Supabase', userId, e);
  }
}

function done() {
  revalidatePath('/admin/bannis');
  revalidatePath('/admin/utilisateurs');
}

// ───────── Bouton « Bannir » de la liste des utilisateurs ─────────
// Récupère TOUT ce qu'on sait de ce client (compte, e-mail, téléphone, IP d'inscription, IP et
// adresses de ses commandes / rendez-vous / demandes) pour le reconnaître même s'il change d'e-mail.
export async function banUser(userId: string, reason: string) {
  const currentAdmin = await requireAdminUser();
  if (currentAdmin.id === userId) return { error: 'Tu ne peux pas te bannir toi-même.' };

  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error || !data?.user) return { error: 'Utilisateur introuvable.' };
  const user = data.user;
  if (user.app_metadata?.role === 'admin') return { error: 'Impossible de bannir un compte administrateur.' };

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const email = user.email ?? '';
  const label = [meta.first_name, meta.last_name].filter(Boolean).join(' ') || email || userId;

  const entries = await loadBanEntries({ fresh: true });
  const normEmail = normalizeEmail(email);
  const entry =
    entries.find((e) => e.userIds.includes(userId) || (normEmail && e.emails.includes(normEmail))) ??
    (() => {
      const e = emptyEntry(label, reason.trim());
      entries.unshift(e);
      return e;
    })();
  if (reason.trim()) entry.reason = reason.trim().slice(0, 500);

  pushUnique(entry.userIds, userId);
  pushUnique(entry.emails, normEmail);
  pushUnique(entry.phones, normalizePhone(meta.phone));
  pushUnique(entry.ips, normalizeIp(meta.signup_ip));
  pushUnique(entry.addresses, normalizeAddress(meta.address_line1, meta.address_zip));

  // Ce que ses commandes, rendez-vous et demandes par correspondance révèlent
  const emailFilter = email ? { equals: email, mode: 'insensitive' as const } : undefined;
  const [orders, appointments, mailIns] = await Promise.all([
    prisma.order.findMany({
      where: { OR: [{ userId }, ...(emailFilter ? [{ customerEmail: emailFilter }] : [])] },
      select: {
        customerEmail: true,
        customerPhone: true,
        ipAddress: true,
        shippingLine1: true,
        shippingZip: true,
        billingLine1: true,
        billingZip: true,
      },
    }),
    prisma.appointment.findMany({
      where: { OR: [{ userId }, ...(emailFilter ? [{ customerEmail: emailFilter }] : [])] },
      select: { customerEmail: true, customerPhone: true },
    }),
    prisma.mailInRepair.findMany({
      where: { OR: [{ userId }, ...(emailFilter ? [{ customerEmail: emailFilter }] : [])] },
      select: { customerEmail: true, customerPhone: true },
    }),
  ]);
  for (const o of orders) {
    pushUnique(entry.emails, normalizeEmail(o.customerEmail));
    pushUnique(entry.phones, normalizePhone(o.customerPhone));
    pushUnique(entry.ips, normalizeIp(o.ipAddress));
    pushUnique(entry.addresses, normalizeAddress(o.shippingLine1, o.shippingZip));
    pushUnique(entry.addresses, normalizeAddress(o.billingLine1, o.billingZip));
  }
  for (const a of [...appointments, ...mailIns]) {
    pushUnique(entry.emails, normalizeEmail(a.customerEmail));
    pushUnique(entry.phones, normalizePhone(a.customerPhone));
  }

  await saveBanEntries(entries);
  await setSupabaseBan(userId, true);
  done();
  return { ok: true as const };
}

// ───────── Page /admin/bannis ─────────

export async function createManualBan(input: {
  label: string;
  reason: string;
  email: string;
  phone: string;
  ip: string;
  addressLine1: string;
  addressZip: string;
}) {
  await requireAdminUser();
  const entry = emptyEntry(input.label.trim() || 'Client banni', input.reason.trim());
  pushUnique(entry.emails, normalizeEmail(input.email));
  pushUnique(entry.phones, normalizePhone(input.phone));
  pushUnique(entry.ips, normalizeIp(input.ip));
  pushUnique(entry.addresses, normalizeAddress(input.addressLine1, input.addressZip));
  if (!entry.emails.length && !entry.phones.length && !entry.ips.length && !entry.addresses.length) {
    return { error: 'Renseigne au moins un e-mail, un téléphone, une IP ou une adresse (numéro + rue + code postal).' };
  }
  const entries = await loadBanEntries({ fresh: true });
  entries.unshift(entry);
  await saveBanEntries(entries);

  // Si cet e-mail correspond déjà à un compte client, on le bannit aussi
  if (entry.emails.length) {
    try {
      const supabaseAdmin = createSupabaseAdminClient();
      const { data } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      for (const u of data?.users ?? []) {
        if (u.app_metadata?.role === 'admin') continue;
        if (u.email && entry.emails.includes(normalizeEmail(u.email))) {
          pushUnique(entry.userIds, u.id);
          await setSupabaseBan(u.id, true);
        }
      }
      await saveBanEntries(entries);
    } catch (e) {
      console.error('Recherche de comptes à bannir impossible', e);
    }
  }
  done();
  return { ok: true as const, entries };
}

export async function addIdentifier(entryId: string, kind: IdentifierKind, value: string) {
  await requireAdminUser();
  const entries = await loadBanEntries({ fresh: true });
  const entry = entries.find((e) => e.id === entryId);
  if (!entry) return { error: 'Entrée introuvable.' };

  const raw = value.trim();
  if (!raw) return { error: 'Valeur vide.' };
  if (kind === 'email') pushUnique(entry.emails, normalizeEmail(raw));
  else if (kind === 'phone') {
    const p = normalizePhone(raw);
    if (!p) return { error: 'Numéro de téléphone invalide (9 chiffres minimum).' };
    pushUnique(entry.phones, p);
  } else if (kind === 'ip') pushUnique(entry.ips, normalizeIp(raw));
  else if (kind === 'address') {
    // saisie "17 avenue Guy Malé, 66650"
    const zip = raw.match(/\b\d{5}\b/)?.[0] ?? '';
    const line = raw.replace(zip, '').replace(/[,;]/g, ' ');
    const a = normalizeAddress(line, zip);
    if (!a) return { error: 'Adresse invalide : indique le numéro, la rue et le code postal (ex. 17 avenue Guy Malé, 66650).' };
    pushUnique(entry.addresses, a);
  } else return { error: 'Type inconnu.' };

  await saveBanEntries(entries);
  done();
  return { ok: true as const, entries };
}

export async function removeIdentifier(entryId: string, kind: IdentifierKind, value: string) {
  await requireAdminUser();
  const entries = await loadBanEntries({ fresh: true });
  const entry = entries.find((e) => e.id === entryId);
  if (!entry) return { error: 'Entrée introuvable.' };

  if (kind === 'userId') {
    entry.userIds = entry.userIds.filter((v) => v !== value);
    await setSupabaseBan(value, false);
  } else if (kind === 'email') entry.emails = entry.emails.filter((v) => v !== value);
  else if (kind === 'phone') entry.phones = entry.phones.filter((v) => v !== value);
  else if (kind === 'ip') entry.ips = entry.ips.filter((v) => v !== value);
  else if (kind === 'address') entry.addresses = entry.addresses.filter((v) => v !== value);

  await saveBanEntries(entries);
  done();
  return { ok: true as const, entries };
}

export async function updateReason(entryId: string, reason: string) {
  await requireAdminUser();
  const entries = await loadBanEntries({ fresh: true });
  const entry = entries.find((e) => e.id === entryId);
  if (!entry) return { error: 'Entrée introuvable.' };
  entry.reason = reason.trim().slice(0, 500);
  await saveBanEntries(entries);
  done();
  return { ok: true as const, entries };
}

// Lève le bannissement : retire l'entrée ET réactive les comptes Supabase associés
export async function unbanEntry(entryId: string) {
  await requireAdminUser();
  const entries = await loadBanEntries({ fresh: true });
  const entry = entries.find((e) => e.id === entryId);
  if (!entry) return { error: 'Entrée introuvable.' };
  for (const id of entry.userIds) await setSupabaseBan(id, false);
  const next = entries.filter((e) => e.id !== entryId);
  await saveBanEntries(next);
  done();
  return { ok: true as const, entries: next };
}

// Depuis la liste des utilisateurs : lève le bannissement du compte (retire l'entrée qui le contient)
export async function unbanUser(userId: string) {
  await requireAdminUser();
  const entries = await loadBanEntries({ fresh: true });
  const hit = entries.find((e) => e.userIds.includes(userId));
  if (hit) {
    for (const id of hit.userIds) await setSupabaseBan(id, false);
    await saveBanEntries(entries.filter((e) => e.id !== hit.id));
  } else {
    await setSupabaseBan(userId, false);
  }
  done();
  return { ok: true as const };
}
