// Diagnostic en lecture seule : pour préparer la lutte contre le contenu dupliqué, ce script échantillonne
// quelques fiches produits par type de pièce (PieceType) et affiche leur description longue en entier.
// Objectif : repérer les paragraphes identiques copiés-collés sur des centaines/milliers de fiches, pour
// ensuite créer plusieurs variantes de chacun (même principe que les intros de région sur les pages
// villes /livraison/[ville]) et les faire tourner automatiquement.
//
// Usage :
//   node scripts/inspect-description-templates.js

require('dotenv').config({ path: require('path').join(__dirname, '../.env.migration') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const PIECE_TYPES = [
  'ECRAN', 'BATTERIE', 'NAPPE_CONNECTEUR', 'CAMERA', 'VITRE_ARRIERE', 'CHASSIS',
  'HAUT_PARLEUR', 'VIBREUR', 'BOUTON', 'OUTILLAGE', 'ACCESSOIRE', 'AUTRE',
];

async function main() {
  // 1) Combien de produits par type, et combien ont une description non vide.
  console.log('========== Répartition par type de pièce ==========');
  for (const type of PIECE_TYPES) {
    const total = await prisma.product.count({ where: { pieceType: type } });
    const withDesc = await prisma.product.count({ where: { pieceType: type, description: { not: null } } });
    console.log(`${type} : ${total} produits (${withDesc} avec description longue)`);
  }

  // 2) Détection grossière de contenu dupliqué : on regarde combien de produits partagent EXACTEMENT
  // les 200 premiers caractères de leur description (signe fort d'un template copié-collé).
  console.log('\n========== Doublons détectés (200 premiers caractères identiques) ==========');
  const all = await prisma.product.findMany({
    where: { description: { not: null } },
    select: { id: true, pieceType: true, description: true },
  });
  const byPrefix = new Map();
  for (const p of all) {
    const prefix = p.description.slice(0, 200);
    if (!byPrefix.has(prefix)) byPrefix.set(prefix, []);
    byPrefix.get(prefix).push(p);
  }
  const groups = [...byPrefix.entries()].filter(([, list]) => list.length >= 5).sort((a, b) => b[1].length - a[1].length);
  console.log(`Total groupes de 5+ produits avec un début de description identique : ${groups.length}`);
  for (const [prefix, list] of groups.slice(0, 15)) {
    const types = [...new Set(list.map((p) => p.pieceType))];
    console.log(`\n  ${list.length} produits [${types.join(', ')}] — début identique : "${prefix.replace(/\s+/g, ' ')}..."`);
  }

  // 3) Échantillon complet (texte intégral) pour les 3 plus gros groupes trouvés, pour voir la structure
  // exacte à varier (jusqu'où le texte est identique, où commence la partie spécifique au produit).
  console.log('\n\n========== Exemples complets (3 produits du plus gros groupe) ==========');
  if (groups.length > 0) {
    const [, biggestGroup] = groups[0];
    for (const p of biggestGroup.slice(0, 2)) {
      const full = await prisma.product.findUnique({ where: { id: p.id }, select: { title: true, slug: true, description: true } });
      console.log(`\n--- ${full.title} (/produit/${full.slug}) ---`);
      console.log(full.description.length > 2500 ? full.description.slice(0, 2500) + '\n...[tronqué]' : full.description);
      console.log('\n' + '='.repeat(80));
    }
  }

  // 4) Un exemple par type de pièce (le plus long, souvent le plus représentatif) pour couvrir tous les
  // gabarits différents (écran / batterie / nappe / vitre / outillage / accessoire...).
  console.log('\n\n========== Un exemple par type de pièce ==========');
  for (const type of PIECE_TYPES) {
    const sample = await prisma.product.findFirst({
      where: { pieceType: type, description: { not: null } },
      orderBy: { updatedAt: 'desc' },
      select: { title: true, slug: true, description: true },
    });
    if (!sample) continue;
    console.log(`\n--- [${type}] ${sample.title} (/produit/${sample.slug}) ---`);
    console.log(sample.description.length > 2500 ? sample.description.slice(0, 2500) + '\n...[tronqué]' : sample.description);
    console.log('\n' + '='.repeat(80));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
