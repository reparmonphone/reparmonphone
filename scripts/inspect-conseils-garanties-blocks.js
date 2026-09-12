// Diagnostic en lecture seule : le premier passage (inspect-description-templates.js) a montré que le
// bloc "NOS CONSEILS ... LES GARANTIES ReparMonPhone ..." revient à l'identique sur énormément de fiches,
// quel que soit le type de pièce (nappe, caméra, bouton, vitre arrière, vibreur, haut-parleur, et une
// bonne partie du fourre-tout "AUTRE"). C'est ce bloc-là qu'on va faire varier en priorité : il est
// générique (aucune info produit dedans), donc on peut le remplacer par plusieurs formulations
// différentes sans rien perdre d'important.
//
// Ce script extrait ce bloc précis sur chaque fiche qui contient "NOS CONSEILS", le normalise (espaces
// multiples réduits à un seul, mais balises HTML conservées) et regroupe les fiches par variante EXACTE
// trouvée. Objectif : savoir combien de formats différents existent réellement (HTML vs texte brut,
// variations de ponctuation...) avant d'écrire le script de remplacement.
//
// Usage :
//   node scripts/inspect-conseils-garanties-blocks.js

require('dotenv').config({ path: require('path').join(__dirname, '../.env.migration') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function extractBlock(desc) {
  const startMatch = desc.match(/(<strong>)?NOS CONSEILS(<\/strong>)?/i);
  if (!startMatch) return null;
  const startIdx = startMatch.index;
  const rest = desc.slice(startIdx);
  const endMatch = rest.match(/retours souples et rapides\.?(<\/strong>)?(<\/li>\s*<\/ul>)?/i);
  if (!endMatch) return null;
  const endIdx = startIdx + endMatch.index + endMatch[0].length;
  return desc.slice(startIdx, endIdx);
}

function normalize(block) {
  return block.replace(/\s+/g, ' ').trim();
}

async function main() {
  const products = await prisma.product.findMany({
    where: { description: { contains: 'NOS CONSEILS' } },
    select: { id: true, slug: true, title: true, pieceType: true, description: true },
  });
  console.log(`Produits contenant "NOS CONSEILS" dans leur description : ${products.length}`);

  const groups = new Map();
  const noBlockFound = [];
  for (const p of products) {
    const block = extractBlock(p.description);
    if (!block) {
      noBlockFound.push(p);
      continue;
    }
    const norm = normalize(block);
    if (!groups.has(norm)) groups.set(norm, []);
    groups.get(norm).push(p);
  }

  console.log(`Blocs extraits avec succès : ${products.length - noBlockFound.length}`);
  console.log(`Non extraits (format inattendu, à vérifier ci-dessous) : ${noBlockFound.length}`);

  const sorted = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
  console.log(`\nNombre de variantes EXACTES distinctes (après normalisation des espaces) : ${sorted.length}`);

  let i = 0;
  for (const [norm, list] of sorted) {
    i++;
    const types = [...new Set(list.map((p) => p.pieceType))];
    console.log(`\n===== Variante #${i} — ${list.length} produits — types de pièce : [${types.join(', ')}] =====`);
    console.log(norm);
    console.log(`Exemples : ${list.slice(0, 3).map((p) => p.slug).join(', ')}`);
  }

  if (noBlockFound.length > 0) {
    console.log(`\n\n========== Échantillon de produits non extraits (format à vérifier, max 5) ==========`);
    for (const p of noBlockFound.slice(0, 5)) {
      console.log(`\n--- ${p.title} (/produit/${p.slug}) [${p.pieceType}] ---`);
      const idx = p.description.search(/NOS CONSEILS/i);
      console.log(p.description.slice(Math.max(0, idx - 20), idx + 600));
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
