'use server';

import { isToken, loadProposal, storeProposal } from '@/lib/proposal';

// Appelée une fois par visite quand le client ouvre son lien : permet de voir « Consultée » dans l'admin.
export async function markProposalViewed(token: string) {
  try {
    if (!isToken(token)) return;
    const p = await loadProposal(token);
    if (!p) return;
    await storeProposal({ ...p, viewCount: p.viewCount + 1, viewedAt: p.viewedAt ?? new Date().toISOString() });
  } catch {
    // jamais bloquant pour le client
  }
}
