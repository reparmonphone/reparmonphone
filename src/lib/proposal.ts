import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { PROPOSAL_PREFIX, isToken, parseProposal, proposalKey, type Proposal } from '@/lib/proposalShared';

export * from '@/lib/proposalShared';

export const newToken = () => randomBytes(12).toString('hex');

export async function loadProposal(token: string): Promise<Proposal | null> {
  if (!isToken(token)) return null;
  const row = await prisma.siteSetting.findUnique({ where: { key: proposalKey(token) } });
  return parseProposal(row?.value);
}

export async function storeProposal(p: Proposal) {
  const value = JSON.stringify(p);
  await prisma.siteSetting.upsert({
    where: { key: proposalKey(p.token) },
    update: { value },
    create: { key: proposalKey(p.token), value },
  });
}

export async function listProposals(limit = 80): Promise<Proposal[]> {
  const rows = await prisma.siteSetting.findMany({
    where: { key: { startsWith: PROPOSAL_PREFIX } },
    orderBy: { updatedAt: 'desc' },
    take: limit,
    select: { value: true },
  });
  return rows.map((r) => parseProposal(r.value)).filter((p): p is Proposal => p !== null);
}
