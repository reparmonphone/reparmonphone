// Générateur de mots-clés / titres / méta-descriptions / brouillons d'article pour le SEO local de
// ReparMonPhone. 100 % "code pur" (aucune API, aucun accès base) : il tourne côté navigateur dans
// /admin/mots-cles et part de gabarits de requêtes réellement tapées sur Google pour une pièce ou une
// réparation de téléphone. Les résultats sont des SUGGESTIONS : à relire et à valider avant publication.

export type PieceKey = 'ecran' | 'batterie' | 'connecteur' | 'camera' | 'vitre-arriere' | 'haut-parleur' | 'vibreur' | 'bouton' | 'chassis';

export type PieceDef = {
  key: PieceKey;
  label: string; // singulier, minuscule
  synonyms: string[]; // autres façons de chercher la même pièce
  symptoms: string[]; // symptômes tapés dans Google (sans le modèle)
  tools: string[]; // outillage classique pour ce remplacement
  difficulty: string;
  duration: string;
};

export const PIECES: PieceDef[] = [
  { key: 'ecran', label: 'écran', synonyms: ['écran LCD', 'écran OLED', 'vitre tactile', 'dalle écran'], symptoms: ['écran cassé', 'écran noir', 'tactile ne répond plus', 'lignes sur écran'], tools: ['tournevis pentalobe/cruciforme', 'ventouse', 'spatule plastique', 'pistolet à air chaud ou sèche-cheveux'], difficulty: 'Moyenne', duration: '30 à 60 min' },
  { key: 'batterie', label: 'batterie', synonyms: ['batterie de remplacement', 'pile téléphone'], symptoms: ['batterie qui se décharge vite', 'batterie gonflée', 'téléphone qui s\'éteint tout seul'], tools: ['tournevis adapté', 'spatule plastique', 'pince à épiler', 'adhésif de batterie'], difficulty: 'Facile à moyenne', duration: '20 à 40 min' },
  { key: 'connecteur', label: 'connecteur de charge', synonyms: ['nappe de charge', 'port de charge', 'prise de charge'], symptoms: ['ne charge plus', 'charge lentement', 'câble qui ne tient pas'], tools: ['tournevis adapté', 'spatule plastique', 'pincette'], difficulty: 'Moyenne', duration: '30 à 45 min' },
  { key: 'camera', label: 'caméra', synonyms: ['appareil photo', 'module caméra', 'caméra arrière'], symptoms: ['caméra floue', 'photos noires', 'caméra qui ne marche plus'], tools: ['tournevis adapté', 'spatule plastique', 'pincette'], difficulty: 'Moyenne', duration: '20 à 40 min' },
  { key: 'vitre-arriere', label: 'vitre arrière', synonyms: ['dos en verre', 'cache batterie', 'coque arrière'], symptoms: ['dos cassé', 'vitre arrière fissurée'], tools: ['pistolet à air chaud', 'ventouse', 'spatule plastique', 'colle/adhésif de vitre'], difficulty: 'Difficile', duration: '45 à 90 min' },
  { key: 'haut-parleur', label: 'haut-parleur', synonyms: ['écouteur interne', 'haut-parleur externe', 'buzzer'], symptoms: ['plus de son', 'son grésille', 'on ne m\'entend pas / je n\'entends pas'], tools: ['tournevis adapté', 'spatule plastique', 'pincette'], difficulty: 'Moyenne', duration: '20 à 40 min' },
  { key: 'vibreur', label: 'vibreur', synonyms: ['moteur vibreur', 'taptic engine'], symptoms: ['ne vibre plus'], tools: ['tournevis adapté', 'spatule plastique'], difficulty: 'Facile à moyenne', duration: '20 à 30 min' },
  { key: 'bouton', label: 'bouton', synonyms: ['bouton power', 'bouton volume', 'nappe boutons'], symptoms: ['bouton bloqué', 'bouton qui ne répond plus'], tools: ['tournevis adapté', 'spatule plastique'], difficulty: 'Moyenne', duration: '20 à 40 min' },
  { key: 'chassis', label: 'châssis', synonyms: ['coque complète', 'châssis complet'], symptoms: ['châssis tordu', 'téléphone plié'], tools: ['jeu de tournevis', 'pistolet à air chaud', 'spatules'], difficulty: 'Difficile', duration: '1 h 30 et plus' },
];

export const DEFAULT_CITIES = ['Sainte-Maxime', 'Saint-Tropez', 'Grimaud', 'Cogolin', 'Fréjus', 'Saint-Raphaël', 'Draguignan', 'Golfe de Saint-Tropez', 'Var'];

export type KeywordGroup = { title: string; hint: string; items: string[] };

const uniq = (list: string[]) => Array.from(new Set(list.map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean)));

export function generateKeywords({ target, pieceKeys, cities }: { target: string; pieceKeys: PieceKey[]; cities: string[] }): KeywordGroup[] {
  const t = target.trim();
  if (!t) return [];
  const pieces = PIECES.filter((p) => pieceKeys.includes(p.key));

  const achat: string[] = [];
  const reparation: string[] = [];
  const questions: string[] = [];
  const symptomes: string[] = [];
  const local: string[] = [];

  for (const p of pieces) {
    const names = [p.label, ...p.synonyms.slice(0, 2)];
    for (const n of names) {
      achat.push(`${n} ${t}`, `${n} ${t} pas cher`);
    }
    achat.push(`acheter ${p.label} ${t}`, `${p.label} ${t} origine`, `${p.label} ${t} compatible`, `${p.label} ${t} livraison 24h`, `${p.label} ${t} avec outils`, `kit réparation ${p.label} ${t}`);
    reparation.push(`réparation ${p.label} ${t}`, `remplacement ${p.label} ${t}`, `changer ${p.label} ${t}`, `prix réparation ${p.label} ${t}`, `${t} ${p.label} cassé`);
    questions.push(`comment changer ${p.label} ${t}`, `tuto remplacement ${p.label} ${t}`, `combien coûte le remplacement ${p.label} ${t}`, `quel ${p.label} choisir pour ${t}`, `${p.label} origine ou compatible ${t}`);
    for (const s of p.symptoms) symptomes.push(`${t} ${s}`);
    for (const c of cities) {
      local.push(`réparation ${p.label} ${t} ${c}`);
    }
  }
  for (const c of cities) {
    local.push(`réparation ${t} ${c}`, `réparateur ${t} ${c}`, `réparation téléphone ${c}`, `écran téléphone ${c}`);
  }

  return [
    { title: 'Achat de pièces (intention d\'achat forte)', hint: 'À utiliser dans les titres produits, catégories et descriptions.', items: uniq(achat) },
    { title: 'Réparation', hint: 'Pour les pages /reparation, rendez-vous et réparation à distance.', items: uniq(reparation) },
    { title: 'Questions et guides', hint: 'Idéal pour les guides de réparation et les FAQ.', items: uniq(questions) },
    { title: 'Symptômes (problème → solution)', hint: 'Ce que tape un client avant de savoir quelle pièce commander.', items: uniq(symptomes) },
    { title: 'Local (Golfe de Saint-Tropez)', hint: 'Pour ta fiche Google Business, pages ville et atelier.', items: uniq(local) },
  ].filter((g) => g.items.length > 0);
}

const SITE = 'ReparMonPhone';

export type TitleMeta = { text: string; length: number; ok: boolean };

function tm(text: string, max: number): TitleMeta {
  return { text, length: text.length, ok: text.length <= max };
}

export function generateTitles({ target, piece }: { target: string; piece: PieceDef }): { titles: TitleMeta[]; metas: TitleMeta[] } {
  const t = target.trim();
  const cap = piece.label.charAt(0).toUpperCase() + piece.label.slice(1);
  const titles = [
    `${cap} ${t} : pièce détachée | ${SITE}`,
    `${cap} ${t} origine ou compatible | ${SITE}`,
    `Remplacer ${piece.label} ${t} – Pièce + guide | ${SITE}`,
    `${cap} ${t} – Livraison 24h | ${SITE}`,
  ].map((s) => tm(s, 60));
  const metas = [
    `${cap} ${t} : qualité origine ou compatible, outils inclus selon modèle. Livraison Chronopost 24h en France métropolitaine. Atelier à Sainte-Maxime.`,
    `Besoin de remplacer ${piece.label} de ton ${t} ? Pièce détachée en stock, guide de réparation et livraison 24h. Réparation possible en atelier à Sainte-Maxime.`,
    `${cap} ${t} au meilleur prix : pièces testées, paiement sécurisé, livraison rapide. Réparateur dans le Golfe de Saint-Tropez.`,
  ].map((s) => tm(s, 155));
  return { titles, metas };
}

export function generateArticle({ target, piece, city }: { target: string; piece: PieceDef; city: string }): { markdown: string; faqJsonLd: string } {
  const t = target.trim();
  const l = piece.label;
  const faq = [
    { q: `Quel est le prix d'un remplacement de ${l} sur ${t} ?`, a: `Le prix dépend de la qualité de la pièce (origine ou compatible) et de la main d'œuvre. Tu peux acheter la pièce seule sur ReparMonPhone ou prendre rendez-vous pour une réparation en atelier à ${city}.` },
    { q: `Peut-on changer soi-même ${l} d'un ${t} ?`, a: `Oui avec un peu de patience et le bon outillage : difficulté ${piece.difficulty.toLowerCase()}, comptez ${piece.duration}. Sinon, notre atelier peut s'en charger.` },
    { q: `Pièce d'origine ou compatible pour ${t} ?`, a: `L'origine offre la meilleure fidélité (affichage, durée, finitions). La compatible coûte moins cher et convient à un usage courant. Les deux sont proposées selon disponibilité.` },
  ];
  const faqJsonLd = JSON.stringify(
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    null,
    2
  );
  const markdown = `# Comment remplacer ${l} sur ${t} (guide pas à pas)

> BROUILLON généré automatiquement : relis, corrige avec les vraies étapes de ce modèle (photos, vis, nappes) puis publie dans /admin/guides.

Votre ${t} a besoin d'un nouveau ${l} ? Ce guide explique comment le remplacer, l'outillage nécessaire et quand il vaut mieux passer par un réparateur à ${city}.

**Difficulté :** ${piece.difficulty} · **Durée :** ${piece.duration}

## Symptômes : comment savoir si ${l} est en cause ?
${piece.symptoms.map((s) => `- ${s}`).join('\n')}

## Outils et pièces nécessaires
${piece.tools.map((s) => `- ${s}`).join('\n')}
- ${l} compatible ${t} (origine ou compatible)

## Étapes de remplacement
1. Éteindre le ${t} et le débrancher.
2. Ouvrir l'appareil avec précaution (retirer les vis, décoller l'adhésif si besoin). [À COMPLÉTER avec les étapes propres à ce modèle]
3. Déconnecter la batterie avant toute manipulation interne.
4. Retirer l'ancien ${l} et noter l'emplacement des vis.
5. Installer le nouveau ${l}, reconnecter les nappes, tester avant de refermer.
6. Refermer, remettre sous tension et vérifier le bon fonctionnement.

## Origine ou compatible ?
Explique en 2-3 phrases la différence de qualité et de prix, et renvoie vers la fiche produit correspondante.

## Pas à l'aise ? Réparation en atelier à ${city}
ReparMonPhone répare aussi ton ${t} en atelier ou à domicile dans le Golfe de Saint-Tropez. [Lien : Prendre rendez-vous]

## Questions fréquentes
${faq.map((f) => `**${f.q}**\n${f.a}`).join('\n\n')}
`;
  return { markdown, faqJsonLd };
}

export type GscRow = { query: string; clicks: number; impressions: number; ctr: number; position: number };

// Lit un export CSV "Requêtes" de Google Search Console (séparateur , ou ;, en-têtes FR ou EN).
export function parseGscCsv(text: string): GscRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const sep = lines[0].includes(';') && !lines[0].includes(',') ? ';' : lines[0].includes('\t') ? '\t' : ',';
  const split = (line: string) => line.split(sep).map((c) => c.trim().replace(/^"|"$/g, ''));
  const head = split(lines[0]).map((h) => h.toLowerCase());
  const idx = (names: string[]) => head.findIndex((h) => names.some((n) => h.includes(n)));
  const iq = idx(['requête', 'requete', 'query', 'top queries', 'principales']);
  const ic = idx(['clics', 'clicks']);
  const ii = idx(['impressions']);
  const ip = idx(['position']);
  const num = (v: string | undefined) => Number((v ?? '0').replace('%', '').replace(',', '.').replace(/\s/g, '')) || 0;
  if (iq < 0) return [];
  return lines.slice(1).map((line) => {
    const c = split(line);
    return { query: c[iq] ?? '', clicks: ic >= 0 ? num(c[ic]) : 0, impressions: ii >= 0 ? num(c[ii]) : 0, ctr: 0, position: ip >= 0 ? num(c[ip]) : 0 };
  }).filter((r) => r.query);
}
