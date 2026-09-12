// Correspondance titre -> référence fournisseur (pieces2mobile.com), réutilisée par
// scripts/backfill-supplier-sku.js (une fois, pour tout le catalogue existant) et
// scripts/weekly-fournisseur-check.js (chaque semaine, seulement pour les produits qui n'ont
// encore aucun SKU fournisseur enregistré).
//
// Méthode : comparaison de texte (distance de Levenshtein sur les mots triés, façon
// "token_sort_ratio") avec DEUX garde-fous stricts qui priment sur le score textuel — sans eux,
// un score élevé peut quand même désigner le mauvais produit (ex: "iPhone 16 Pro" vs "iPhone 15",
// ou "Note 10+ (N975F)" vs "Galaxy A41 (A415F)" se ressemblent beaucoup en texte brut) :
//   1. Codes modèle identiques : tout token contenant un chiffre (N975F, G988B, 13, 5s...), ou un
//      suffixe lettré connu (X, XR, XS, SE, Plus, Ultra, Max, Pro, Mini, FE, Lite...), doit se
//      retrouver À L'IDENTIQUE des deux côtés.
//   2. Type de pièce cohérent : si les deux titres contiennent un mot de la liste PART_TYPE_WORDS
//      (écran, vitre, nappe, batterie...), ces mots doivent avoir au moins un point commun.
// Sans ces deux règles, le score textuel seul valide trop souvent la mauvaise référence.

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

function normalize(text) {
  if (!text) return '';
  return text
    .toString()
    .replace(/[‑’`]/g, (c) => (c === '’' || c === '`' ? "'" : '-'))
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // retire les accents (diacritiques combinants)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function allTokens(norm) {
  return norm ? norm.split(' ').filter(Boolean) : [];
}

function blockTokens(tokens) {
  return tokens.filter((t) => t.length >= 3);
}

function keyTokens(tokens) {
  return new Set(tokens.filter((t) => /[0-9]/.test(t) || LETTER_MODEL_TOKENS.has(t)));
}

function partTokens(tokens) {
  return new Set(tokens.filter((t) => PART_TYPE_WORDS.has(t)));
}

function setsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

function setsDisjoint(a, b) {
  for (const v of a) if (b.has(v)) return false;
  return true;
}

// Distance de Levenshtein classique (programmation dynamique, une seule ligne de mémoire).
function levenshtein(a, b) {
  if (a === b) return 0;
  const la = a.length, lb = b.length;
  if (la === 0) return lb;
  if (lb === 0) return la;
  let prev = new Array(lb + 1);
  for (let j = 0; j <= lb; j++) prev[j] = j;
  for (let i = 1; i <= la; i++) {
    const curr = new Array(lb + 1);
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

// Équivalent de rapidfuzz.fuzz.token_sort_ratio : les mots de chaque chaîne sont triés
// alphabétiquement avant comparaison (insensible à l'ordre des mots), puis on calcule un ratio de
// similarité à partir de la distance de Levenshtein sur ces deux chaînes réordonnées.
function tokenSortRatio(normA, normB) {
  const sortedA = allTokens(normA).sort().join(' ');
  const sortedB = allTokens(normB).sort().join(' ');
  const maxLen = sortedA.length + sortedB.length;
  if (maxLen === 0) return 100;
  const dist = levenshtein(sortedA, sortedB);
  return ((maxLen - dist) / maxLen) * 100;
}

const MAX_POSTINGS = 400; // un token présent dans plus de X fiches fournisseur n'aide pas à cibler
const MAX_CANDIDATES = 60;
const THRESHOLD = 88;

// Construit un index inversé token -> [indices] sur la liste fournisseur (tableaux de
// { nom, sku, prix, disponibilite }), pour retrouver rapidement les candidats plausibles sans
// comparer chaque produit à TOUTE la liste fournisseur (trop lent à l'échelle de ~12000 lignes).
function buildSupplierIndex(supplierRows) {
  const prepared = supplierRows.map((row) => {
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

  const tokenIndex = new Map();
  prepared.forEach((row, idx) => {
    for (const t of new Set(row._blockTokens)) {
      if (!tokenIndex.has(t)) tokenIndex.set(t, []);
      tokenIndex.get(t).push(idx);
    }
  });

  const discriminant = new Set();
  for (const [t, ids] of tokenIndex.entries()) {
    if (ids.length <= MAX_POSTINGS) discriminant.add(t);
  }

  return { prepared, tokenIndex, discriminant };
}

// Cherche la meilleure correspondance pour un titre donné dans l'index fournisseur construit
// ci-dessus. Retourne { row, score } ou null si rien ne passe les garde-fous + le seuil.
function findBestMatch(title, index) {
  const norm = normalize(title);
  const tokens = allTokens(norm);
  const bTokens = blockTokens(tokens);
  const kTokens = keyTokens(tokens);
  const pTokens = partTokens(tokens);

  const candCounts = new Map();
  for (const t of bTokens) {
    if (!index.discriminant.has(t)) continue;
    for (const idx of index.tokenIndex.get(t) || []) {
      candCounts.set(idx, (candCounts.get(idx) || 0) + 1);
    }
  }
  if (candCounts.size === 0) {
    for (const t of bTokens) {
      for (const idx of index.tokenIndex.get(t) || []) {
        candCounts.set(idx, (candCounts.get(idx) || 0) + 1);
      }
    }
  }
  if (candCounts.size === 0) return null;

  const top = [...candCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, MAX_CANDIDATES);

  let best = null;
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

module.exports = { normalize, buildSupplierIndex, findBestMatch, THRESHOLD };
