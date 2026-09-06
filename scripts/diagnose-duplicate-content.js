// Diagnostic en lecture seule : l'hypothèse "pages trop vides" est écartée (voir diagnose-thin-content.js
// — les exemples de Soft 404 ont en réalité 900 à 2800 caractères de description). Nouvelle hypothèse à
// vérifier : un contenu-modèle répété quasi à l'identique sur des milliers de fiches (mêmes paragraphes
// "DIAGNOSTIC DE PANNE", "NOS CONSEILS...", "GARANTIE ÉCRAN...", avec juste le nom du modèle/couleur
// changé) — c'est un classique du duplicate content à grande échelle que Google peut sanctionner même
// quand chaque page prise isolément semble avoir "assez" de texte.
//
// Ce script compte combien de produits contiennent ces sections-modèles, pour évaluer l'ampleur réelle
// du phénomène avant de décider quoi que ce soit.
//
// Usage :
//   node scripts/diagnose-duplicate-content.js

require('dotenv').config({ path: require('path').join(__dirname, '../.env.migration') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Fragments de titres de section vus dans l'exemple "Écran Samsung Galaxy S21+" — s'ils reviennent sur
// des milliers de fiches avec un texte quasi identique autour, c'est le signe d'un contenu généré en
// masse par substitution (nom de modèle/couleur), plutôt qu'un texte réellement unique par produit.
const BOILERPLATE_MARKERS = [
  'DIAGNOSTIC DE PANNE',
  'NOS CONSEILS EN MATIÈRE DE REMPLACEMENT',
  'GARANTIE ÉCRAN',
  'INFORMATIONS SUPPLÉMENTAIRES',
];

async function main() {
  const total = await prisma.product.count();
  console.log(`${total} produit(s) au total.\n`);

  for (const marker of BOILERPLATE_MARKERS) {
    const count = await prisma.product.count({ where: { description: { contains: marker } } });
    console.log(`Contient "${marker}" : ${count} produit(s) (${((count / total) * 100).toFixed(1)}%)`);
  }

  // Regarde de plus près deux variantes très proches d'un même produit (couleurs différentes d'un même
  // écran, si elles existent) pour comparer leur texte à l'œil.
  console.log('\n--- Exemple concret : deux variantes de couleur du même écran (si elles existent) ---');
  const sample = await prisma.product.findMany({
    where: { title: { contains: 'Écran Samsung Galaxy S21+ 5G (G996B)' } },
    select: { title: true, description: true },
    take: 3,
  });
  for (const p of sample) {
    const text = (p.description || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    console.log(`\n"${p.title}" (${text.length} car.) :`);
    console.log(text.slice(0, 300) + '...');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
