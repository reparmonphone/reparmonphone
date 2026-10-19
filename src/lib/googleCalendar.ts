import crypto from 'crypto';
import { prisma } from './prisma';
import { RDV_DURATION_MIN } from './rdvAvailability';

// Synchronisation des rendez-vous avec Google Agenda.
// Principe : un « compte de service » Google (un robot) reçoit le droit de modifier TON agenda ; il y crée,
// met à jour ou supprime les événements des RDV. Identifiants dans les variables d'environnement
// GOOGLE_SERVICE_ACCOUNT_EMAIL et GOOGLE_PRIVATE_KEY ; l'identifiant de l'agenda et l'interrupteur
// se règlent dans l'admin (Rendez-vous > Google Agenda).

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.reparmonphone.fr';
const TIMEZONE = 'Europe/Paris';

export type GcalSettings = { enabled: boolean; calendarId: string };

export function getServiceAccount() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? '';
  // Dans Vercel / .env, la clé est souvent collée avec des « \n » littéraux : on les remet en vrais sauts de ligne
  const key = (process.env.GOOGLE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n').replace(/^"|"$/g, '');
  return { email, key, configured: !!email && key.includes('PRIVATE KEY') };
}

export async function getGcalSettings(): Promise<GcalSettings> {
  const rows = await prisma.siteSetting.findMany({ where: { key: { in: ['gcal_enabled', 'gcal_calendar_id'] } } });
  const map = new Map(rows.map((r: { key: string; value: string }) => [r.key, r.value] as [string, string]));
  return { enabled: map.get('gcal_enabled') === 'true', calendarId: map.get('gcal_calendar_id') ?? '' };
}

function b64url(input: Buffer | string) {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token;
  const { email, key, configured } = getServiceAccount();
  if (!configured) throw new Error('Identifiants Google manquants (GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY).');

  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(
    JSON.stringify({
      iss: email,
      scope: 'https://www.googleapis.com/auth/calendar.events',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })
  );
  const signature = b64url(crypto.createSign('RSA-SHA256').update(`${header}.${claims}`).sign(key));

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claims}.${signature}`,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) {
    throw new Error(`Connexion à Google refusée : ${json.error_description ?? json.error ?? res.status}`);
  }
  cachedToken = { token: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 };
  return cachedToken.token;
}

async function calendarFetch(calendarId: string, path: string, init: RequestInit = {}) {
  const token = await getAccessToken();
  return fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
}

type ApptForCalendar = {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  deviceBrand: string;
  deviceModel: string;
  issueDescription: string;
  type: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  preferredDate: Date;
  status: string;
};

// L'heure du RDV est enregistrée « telle que saisie » (voir /api/rdv) : on relit donc l'heure murale avec toISOString.
function startEnd(preferredDate: Date) {
  const start = preferredDate.toISOString().slice(0, 19);
  const end = new Date(preferredDate.getTime() + RDV_DURATION_MIN * 60_000).toISOString().slice(0, 19);
  return { start, end };
}

function eventTitle(a: ApptForCalendar) {
  const prefix = a.status === 'CONFIRMED' ? '✅ RDV' : a.status === 'DONE' ? '☑️ Terminé' : '🕓 À confirmer';
  const where = a.type === 'DOMICILE' ? '🏠' : '🔧';
  return `${prefix} · ${where} ${a.customerName} — ${a.deviceBrand} ${a.deviceModel}`;
}

function eventLocation(a: ApptForCalendar) {
  if (a.type === 'DOMICILE') {
    return a.latitude && a.longitude ? `${a.latitude},${a.longitude}` : `${a.city}, France`;
  }
  return 'ReparMonPhone, Les Saquèdes, 83120 Sainte-Maxime';
}

function eventDescription(a: ApptForCalendar) {
  return [
    `Client : ${a.customerName}`,
    `Téléphone : ${a.customerPhone}`,
    `E-mail : ${a.customerEmail}`,
    `Appareil : ${a.deviceBrand} ${a.deviceModel}`,
    `Type : ${a.type === 'DOMICILE' ? `À domicile (${a.city})` : 'En atelier'}`,
    '',
    `Panne : ${a.issueDescription}`,
    '',
    `Gérer la demande : ${SITE_URL}/admin/rdv/${a.id}`,
  ].join('\n');
}

function eventBody(a: ApptForCalendar) {
  const { start, end } = startEnd(a.preferredDate);
  return {
    summary: eventTitle(a),
    description: eventDescription(a),
    location: eventLocation(a),
    start: { dateTime: start, timeZone: TIMEZONE },
    end: { dateTime: end, timeZone: TIMEZONE },
    colorId: a.status === 'CONFIRMED' ? '10' : a.status === 'DONE' ? '8' : '5',
    reminders: { useDefault: true },
  };
}

/** Lien « Ajouter à Google Agenda » (ne demande aucune configuration, pratique en secours). */
export function googleCalendarTemplateUrl(a: ApptForCalendar) {
  const fmt = (iso: string) => iso.replace(/[-:]/g, '').slice(0, 15); // 20261019T140000
  const { start, end } = startEnd(a.preferredDate);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: eventTitle(a),
    dates: `${fmt(start)}/${fmt(end)}`,
    details: eventDescription(a),
    location: eventLocation(a),
    ctz: TIMEZONE,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Met l'agenda Google à jour pour un RDV : crée l'événement, le met à jour (statut, heure…) ou le supprime
 * (RDV annulé). Ne lève jamais d'erreur : un souci Google ne doit jamais bloquer une demande de RDV.
 */
export async function syncAppointmentToCalendar(appointmentId: string): Promise<{ ok?: boolean; skipped?: string; error?: string }> {
  try {
    const settings = await getGcalSettings();
    if (!settings.enabled || !settings.calendarId) return { skipped: 'Synchronisation désactivée.' };
    if (!getServiceAccount().configured) return { error: 'Identifiants Google non configurés.' };

    const appt = await prisma.appointment.findUnique({ where: { id: appointmentId } });
    if (!appt) return { error: 'Rendez-vous introuvable.' };

    // RDV annulé : on retire l'événement de l'agenda
    if (appt.status === 'CANCELLED') {
      if (appt.googleEventId) {
        await calendarFetch(settings.calendarId, `/events/${encodeURIComponent(appt.googleEventId)}`, { method: 'DELETE' });
        await prisma.appointment.update({ where: { id: appt.id }, data: { googleEventId: null } });
      }
      return { ok: true };
    }

    const body = JSON.stringify(eventBody(appt));

    if (appt.googleEventId) {
      const res = await calendarFetch(settings.calendarId, `/events/${encodeURIComponent(appt.googleEventId)}`, {
        method: 'PATCH',
        body,
      });
      if (res.ok) return { ok: true };
      // Événement supprimé à la main dans l'agenda : on le recrée
      if (res.status !== 404 && res.status !== 410) {
        return { error: `Google Agenda a refusé la mise à jour (${res.status}).` };
      }
    }

    const res = await calendarFetch(settings.calendarId, '/events', { method: 'POST', body });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.id) {
      return { error: `Google Agenda a refusé l'ajout (${res.status}) : ${json?.error?.message ?? 'erreur inconnue'}` };
    }
    await prisma.appointment.update({ where: { id: appt.id }, data: { googleEventId: json.id } });
    return { ok: true };
  } catch (e) {
    console.error('Erreur synchronisation Google Agenda', e);
    return { error: e instanceof Error ? e.message : 'Erreur inconnue.' };
  }
}

/** Test de connexion : crée puis supprime aussitôt un événement de test dans l'agenda indiqué. */
export async function testCalendarConnection(calendarId: string): Promise<{ ok?: boolean; error?: string }> {
  try {
    if (!getServiceAccount().configured) {
      return { error: 'Identifiants Google non configurés (variables GOOGLE_SERVICE_ACCOUNT_EMAIL et GOOGLE_PRIVATE_KEY).' };
    }
    const start = new Date(Date.now() + 24 * 3600_000).toISOString().slice(0, 19);
    const end = new Date(Date.now() + 25 * 3600_000).toISOString().slice(0, 19);
    const res = await calendarFetch(calendarId, '/events', {
      method: 'POST',
      body: JSON.stringify({
        summary: 'Test ReparMonPhone (supprimé automatiquement)',
        start: { dateTime: start, timeZone: TIMEZONE },
        end: { dateTime: end, timeZone: TIMEZONE },
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.id) {
      if (res.status === 404) return { error: "Agenda introuvable : vérifie l'identifiant de l'agenda (ton adresse Gmail pour l'agenda principal)." };
      if (res.status === 403) return { error: "Accès refusé : partage ton agenda avec l'e-mail du compte de service, avec le droit « Apporter des modifications aux événements »." };
      return { error: `Google a répondu ${res.status} : ${json?.error?.message ?? 'erreur inconnue'}` };
    }
    await calendarFetch(calendarId, `/events/${encodeURIComponent(json.id)}`, { method: 'DELETE' });
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur inconnue.' };
  }
}
