'use server';

import { markScratched, verifyUnsubToken } from '@/lib/marketing';

// Enregistre que le client a gratté son ticket (sert d'indicateur dans l'admin « Relance inscrits »).
// Le lien est signé : on ne peut pas marquer l'adresse de quelqu'un d'autre.
export async function recordScratch(email: string, token: string): Promise<{ ok: boolean }> {
  if (!email || !verifyUnsubToken(email, token, 'ticket')) return { ok: false };
  try {
    await markScratched(email);
  } catch {
    return { ok: false };
  }
  return { ok: true };
}
