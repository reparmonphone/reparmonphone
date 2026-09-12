// Port TypeScript de scripts/lib/matchSupplier.js, pour pouvoir lancer la même correspondance
// titre -> référence fournisseur directement depuis le site (bouton "Lancer la vérification" sur
// /admin/fournisseur, voir src/lib/supplierCheck.ts), sans dépendre d'un script Node externe.
//
// ATTENTION : ce fichier duplique volontairement l'algorithme de scripts/lib/matchSupplier.js
// plutôt que de l'importer (un require() d'un chemin hors de src/ n'est pas garanti d'être inclus
// par le traçage de fichiers de Next.js/Vercel au build) — si jamais l'algorithme évolue un jour
// (seuils, garde-fous...), pense à répercuter le changement dans LES DEUX fichiers.

export type SupplierRow = { nom: string; sku: string; prix: number; disponibilite: string };

type PreparedRow = SupplierRow & {
  _norm: string;
  _blockTokens: string[];
  _keyTokens: Set<string>;
  _partTokens: Set<string>;
};

export type SupplierIndex = { prepared: PreparedRow[]; tokenIndex: Map<string, number[]> };

const LETTER_MODEL_TOKENS = new Set([
  'x', 'xr', 'xs', 'se', 'max', 'mini', 'plus', 'pro', 'ultra', 'fe', 'lite', 'air', 'edge', 'note',
]);

const PART_TYPE_WORDS = new Set([
  'ecran', 'vitre', 'chassis', 'nappe', 'connecteur', 'camera', 'batterie',
  'haut', 'parleur', 'bouton', 'tiroir', 'adhesif', 'verre', 'coque', 'protection',
  'stylet', 'vibreur', 'antenne', 'capteur', 'microphone', 'prise', 'cable',
  'chargeur', 'support', 'film', 'afficheur', 'housse', 'coussinet', 'joint',
  'ventouse', 'outillage', 'outil', 'vis', 'grille',
]);

export function normalize(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .toString()
    .replace(/[‑’`]/g, (c) => (c === '’' || c === '`' ? "'" : '-'))
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function allTokens(norm: string): string[] {
  return norm ? norm.split(' ').filter(Boolean) : [];
}

function blockTokens(tokens: string[]): string[] {
  return tokens.filter((t) => t.length >= 3);
}

function keyTokens(tokens: string[]): Set<string> {
  return new Set(tokens.filter((t) => /[0-9]/.test(t) || LETTER_MODEL_TOKENS.has(t)));
}

function partTokens(tokens: string[]): Set<string> {
  return new Set(tokens.filter((t) => PART_TYPE_WORDS.has(t)));
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

function setsDisjoint(a: Set<string>, b: Set<string>): boolean {
  for (const v of a) if (b.has(v)) return false;
  return true;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const la = a.length, lb = b.length;
  if (la === 0) return lb;
  if (lb === 0) return la;
  let prev: number[] = new Array(lb + 1);
  for (let j = 0; j <= lb; j++) prev[j] = j;
  for (let i = 1; i <= la; i++) {
    const curr: number[] = new Array(lb + 1);
    curr[0] = i;
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= lb; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  return prev[lb];
}

function tokenSortRatio(normA: string, normB: string): number {
  const sortedA = allTokens(normA).sort().join(' ');
  const sortedB = allTokens(normB).sort().join(' ');
  const maxLen = sortedA.length + sortedB.length;
  if (maxLen === 0) return 100;
  const dist = levenshtein(sortedA, sortedB);
  return ((maxLen - dist) / maxLen) * 100;
}

const MAX_CANDIDATES = 300;
export const THRESHOLD = 88;

export function buildSupplierIndex(supplierRows: SupplierRow[]): SupplierIndex {
  const prepared: PreparedRow[] = supplierRows.map((row) => {
    const norm = normalize(row.nom);
    const tokens = allTokens(norm);
    return {
      ...row,
      _norm: norm,
      _blockTokens: blockTokens(tokens),
      _keyTokens: keyTokens(tokens),
      _partTokens: partTokens(tokens),
    };
  });

  const tokenIndex = new Map<string, number[]>();
  prepared.forEach((row, idx) => {
    for (const t of new Set(row._blockTokens)) {
      if (!tokenIndex.has(t)) tokenIndex.set(t, []);
      tokenIndex.get(t)!.push(idx);
    }
  });

  return { prepared, tokenIndex };
}

export function findBestMatch(title: string, index: SupplierIndex): { row: SupplierRow; score: number } | null {
  const norm = normalize(title);
  const tokens = allTokens(norm);
  const bTokens = blockTokens(tokens);
  const kTokens = keyTokens(tokens);
  const pTokens = partTokens(tokens);

  const candCounts = new Map<number, number>();
  for (const t of bTokens) {
    for (const idx of index.tokenIndex.get(t) || []) {
      candCounts.set(idx, (candCounts.get(idx) || 0) + 1);
    }
  }
  if (candCounts.size === 0) return null;

  const top = [...candCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, MAX_CANDIDATES);

  let best: PreparedRow | null = null;
  let bestScore = -1;
  for (const [idx] of top) {
    const cand = index.prepared[idx];
    if (kTokens.size > 0 && !setsEqual(kTokens, cand._keyTokens)) continue;
    if (pTokens.size > 0 && cand._partTokens.size > 0 && setsDisjoint(pTokens, cand._partTokens)) continue;
    const score = tokenSortRatio(norm, cand._norm);
    if (score > bestScore) {
      bestScore = score;
      best = cand;
    }
  }

  if (best && bestScore >= THRESHOLD) {
    return { row: best, score: Math.round(bestScore * 10) / 10 };
  }
  return null;
}
