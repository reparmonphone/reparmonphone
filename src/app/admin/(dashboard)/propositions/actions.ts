'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdminUser } from '@/lib/supabase-server';
import { getResendClient } from '@/lib/resend';
import { parisToday } from '@/lib/seasonalThemes';
import {
  addDays,
  isEmail,
  isToken,
  loadProposal,
  newToken,
  proposalKey,
  round2,
  storeProposal,
  type Proposal,
} from '@/lib/proposal';
import { buildProposalEmail } from '@/lib/proposalEmail';

const FROM = process.env.RESEND_FROM_EMAIL ?? 'ReparMonPhone <contact@reparmonphone.fr>';

export type ProposalInput = {
  token?: string; // présent = modification d'une proposition existante (le lien reste le même)
  customerName: string;
  customerEmail: string;
  message: string;
  validDays: number;
  items: { productId: string; quantity: number }[];
  labor: { label: string; price: number | string }[];
};

export type ProductHit = { id: string; slug: string; title: string; price: number; imageUrl: string | null; inStock: boolean };

// Recherche d'un produit par mots du titre (tous les mots doivent y figurer).
export async function searchProductsForProposal(query: string): Promise<ProductHit[]> {
  await requireAdminUser();
  const words = String(query ?? '')
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .slice(0, 6);
  if (words.join('').length < 2) return [];
  const rows = await prisma.product.findMany({
    where: { AND: words.map((w) => ({ title: { contains: w, mode: 'insensitive' as const } })) },
    orderBy: [{ inStock: 'desc' }, { title: 'asc' }],
    take: 15,
    select: { id: true, slug: true, title: true, price: true, imageUrl: true, inStock: true },
  });
  return rows.map((r) => ({ ...r, price: Number(r.price), inStock: r.inStock !== false }));
}

// Enregistre la proposition. Titres, prix et images sont relus dans le catalogue (jamais repris du navigateur).
export async function saveProposal(input: ProposalInput) {
  await requireAdminUser();

  const customerName = String(input?.customerName ?? '').trim().slice(0, 100);
  const customerEmail = String(input?.customerEmail ?? '').trim().toLowerCase().slice(0, 200);
  const message = String(input?.message ?? '').trim().slice(0, 1500);
  if (customerEmail && !isEmail(customerEmail)) return { error: 'L’adresse e-mail du client n’est pas valide.' };

  const wanted = (Array.isArray(input?.items) ? input.items : []).slice(0, 30);
  const ids = wanted.map((i) => String(i.productId));
  const products = ids.length
    ? await prisma.product.findMany({
        where: { id: { in: ids } },
        select: { id: true, slug: true, title: true, price: true, imageUrl: true, inStock: true },
      })
    : [];
  const items: Proposal['items'] = [];
  for (const w of wanted) {
    const p = products.find((x) => x.id === w.productId);
    const quantity = Math.round(Number(w.quantity));
    if (!p) return { error: 'Un des produits n’existe plus : retire-le de la liste.' };
    if (p.inStock === false) return { error: `« ${p.title} » est en rupture de stock : il ne peut pas être proposé.` };
    if (!(quantity >= 1 && quantity <= 99)) return { error: 'Les quantités doivent être comprises entre 1 et 99.' };
    items.push({ productId: p.id, slug: p.slug, title: p.title, price: round2(Number(p.price)), imageUrl: p.imageUrl, quantity });
  }

  const labor: Proposal['labor'] = [];
  for (const l of (Array.isArray(input?.labor) ? input.labor : []).slice(0, 10)) {
    const label = String(l?.label ?? '').trim().slice(0, 120);
    const raw = String(l?.price ?? '').replace(',', '.').trim();
    if (!label && !raw) continue; // ligne laissée vide
    const price = Number(raw);
    if (!label || !Number.isFinite(price) || price < 0 || price > 5000) {
      return { error: 'Chaque ligne de main d’œuvre doit avoir un libellé et un prix (entre 0 et 5 000 €).' };
    }
    labor.push({ label, price: round2(price) });
  }

  if (items.length === 0 && labor.length === 0) return { error: 'Ajoute au moins un produit ou une ligne de main d’œuvre.' };

  const validDays = [7, 14, 30].includes(Number(input?.validDays)) ? Number(input.validDays) : 14;
  const existing = input?.token && isToken(input.token) ? await loadProposal(input.token) : null;

  const proposal: Proposal = {
    token: existing?.token ?? newToken(),
    createdAt: existing?.createdAt || new Date().toISOString(),
    validUntil: addDays(parisToday(), validDays),
    customerName,
    customerEmail,
    message,
    items,
    labor,
    sentAt: existing?.sentAt ?? null,
    viewedAt: existing?.viewedAt ?? null,
    viewCount: existing?.viewCount ?? 0,
  };
  await storeProposal(proposal);
  revalidatePath('/admin/propositions');
  return { ok: true as const, proposal };
}

// Envoie (ou renvoie) la proposition par e-mail au client.
export async function sendProposalEmail(token: string) {
  await requireAdminUser();
  const proposal = isToken(token) ? await loadProposal(token) : null;
  if (!proposal) return { error: 'Proposition introuvable.' };
  if (!isEmail(proposal.customerEmail)) return { error: 'Renseigne l’adresse e-mail du client, puis enregistre.' };

  const resend = getResendClient();
  if (!resend) return { error: 'L’envoi d’e-mails n’est pas configuré (clé Resend manquante).' };

  const { subject, html, text } = buildProposalEmail(proposal);
  try {
    const res = await resend.emails.send({ from: FROM, to: proposal.customerEmail, subject, html, text });
    if (res.error) return { error: `L’e-mail n’est pas parti : ${res.error.message}` };
    if (res.data?.id === 'skipped-banned') return { error: 'Ce client figure dans la liste des clients bannis : e-mail non envoyé.' };
  } catch (e) {
    return { error: `L’e-mail n’est pas parti : ${e instanceof Error ? e.message : 'erreur inconnue'}` };
  }

  const sent: Proposal = { ...proposal, sentAt: new Date().toISOString() };
  await storeProposal(sent);
  revalidatePath('/admin/propositions');
  return { ok: true as const, proposal: sent };
}

export async function deleteProposal(token: string) {
  await requireAdminUser();
  if (!isToken(token)) return { error: 'Proposition introuvable.' };
  await prisma.siteSetting.deleteMany({ where: { key: proposalKey(token) } });
  revalidatePath('/admin/propositions');
  return { ok: true as const };
}
