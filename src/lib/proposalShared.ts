// Propositions clients : un panier (pièces du catalogue, avec ou sans main d'œuvre) préparé dans
// /admin/propositions, envoyé par e-mail avec un lien /proposition/<code> qui remplit le panier du client.
// Stockage : table site_settings (une ligne « proposal:<code> » par proposition) — aucune migration de base.
// Ce fichier ne contient que du code « pur » (utilisable aussi côté navigateur) ; l'accès base est dans proposal.ts.

export const PROPOSAL_PREFIX = 'proposal:';
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.reparmonphone.fr';

export type ProposalItem = {
  productId: string;
  slug: string;
  title: string;
  price: number; // prix TTC unitaire au moment de la proposition
  imageUrl: string | null;
  quantity: number;
};

export type ProposalLabor = { label: string; price: number };

export type Proposal = {
  token: string;
  createdAt: string; // ISO
  validUntil: string; // AAAA-MM-JJ (dernier jour de validité, heure de Paris)
  customerName: string;
  customerEmail: string;
  message: string;
  items: ProposalItem[];
  labor: ProposalLabor[];
  sentAt: string | null; // dernier envoi par e-mail (ISO)
  viewedAt: string | null; // première consultation du lien (ISO)
  viewCount: number;
};

const TOKEN_RE = /^[a-f0-9]{24}$/;
export const isToken = (t: unknown): t is string => typeof t === 'string' && TOKEN_RE.test(t);
export const proposalKey = (token: string) => PROPOSAL_PREFIX + token;
export const proposalUrl = (token: string) => `${SITE_URL}/proposition/${token}`;

export const round2 = (n: number) => Math.round(n * 100) / 100;
export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

export const itemsTotal = (items: { price: number; quantity: number }[]) =>
  round2(items.reduce((s, i) => s + i.price * i.quantity, 0));
export const laborTotal = (labor: { price: number }[]) => round2(labor.reduce((s, l) => s + l.price, 0));
export const proposalTotal = (p: Pick<Proposal, 'items' | 'labor'>) => round2(itemsTotal(p.items) + laborTotal(p.labor));

// « 2026-11-18 » + 14 jours → « 2026-12-02 »
export function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const isExpired = (p: Pick<Proposal, 'validUntil'>, today: string) => today > p.validUntil;

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const money = (v: unknown, max: number) => {
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  return Number.isFinite(n) && n >= 0 && n <= max ? round2(n) : null;
};

// Relit une proposition enregistrée (ou la rejette si elle est illisible).
export function sanitizeProposal(raw: unknown): Proposal | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!isToken(r.token)) return null;
  const items: ProposalItem[] = [];
  for (const it of Array.isArray(r.items) ? r.items : []) {
    const o = (it ?? {}) as Record<string, unknown>;
    const price = money(o.price, 100000);
    const quantity = Math.round(Number(o.quantity));
    if (typeof o.productId !== 'string' || !o.productId || price === null || !(quantity >= 1 && quantity <= 99)) continue;
    items.push({
      productId: o.productId,
      slug: str(o.slug, 200),
      title: str(o.title, 250),
      price,
      imageUrl: typeof o.imageUrl === 'string' && o.imageUrl ? o.imageUrl : null,
      quantity,
    });
  }
  const labor: ProposalLabor[] = [];
  for (const l of Array.isArray(r.labor) ? r.labor : []) {
    const o = (l ?? {}) as Record<string, unknown>;
    const price = money(o.price, 5000);
    const label = str(o.label, 120);
    if (label && price !== null) labor.push({ label, price });
  }
  return {
    token: r.token,
    createdAt: str(r.createdAt, 40),
    validUntil: /^\d{4}-\d{2}-\d{2}$/.test(String(r.validUntil)) ? String(r.validUntil) : '',
    customerName: str(r.customerName, 100),
    customerEmail: str(r.customerEmail, 200),
    message: str(r.message, 1500),
    items,
    labor,
    sentAt: typeof r.sentAt === 'string' ? r.sentAt : null,
    viewedAt: typeof r.viewedAt === 'string' ? r.viewedAt : null,
    viewCount: Number.isFinite(Number(r.viewCount)) ? Math.max(0, Math.round(Number(r.viewCount))) : 0,
  };
}

export function parseProposal(value: string | null | undefined): Proposal | null {
  if (!value) return null;
  try {
    return sanitizeProposal(JSON.parse(value));
  } catch {
    return null;
  }
}

