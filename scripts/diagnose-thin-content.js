// Diagnostic en lecture seule (aucune écriture) : creusé suite aux ~1400 pages produit marquées
// "Soft 404" par Google Search Console (page chargée avec succès, mais jugée trop pauvre en contenu
// pour être indexée). Dans src/app/produit/[slug]/page.tsx, le bloc "grande description" (la partie
// la plus riche visuellement de la fiche) ne s'affiche QUE si product.description est rempli — sinon
// la page ne montre que : titre, prix, badge stock, et éventuellement shortDescription. Ce script
// mesure combien de produits sont dans ce cas, pour confirmer (ou infirmer) que c'est la cause
// principale du souci, avant d'écrire quoi que ce soit.
//
// Usage :
//   node scripts/diagnose-thin-content.js

require('dotenv').config({ path: require('path').join(__dirname, '../.env.migration') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Quelques URLs vues dans le rapport "Soft 404" de Search Console — pour vérifier directement leur
// état en base.
const SAMPLE_SLUGS = [
  'nappe-connecteur-de-charge-ipad-mini-3-blanc',
  'vitre-tactile-ipad-air-ipad-2017-9-7-noir',
  'iphone-14-rouge-256go-reconditionne-grade-a',
  'ecran-iphone-6s-noir-reconditionne-piec',
  'battrie-ipad-a1376',
];

function textLength(html) {
  if (!html) return 0;
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().length;
}

async function main() {
  const total = await prisma.product.count();

  const noDescription = await prisma.product.count({
    where: { OR: [{ description: null }, { description: '' }] },
  });
  const noShortDescription = await prisma.product.count({
    where: { OR: [{ shortDescription: null }, { shortDescription: '' }] },
  });
  const bothEmpty = await prisma.product.count({
    where: {
      AND: [
        { OR: [{ description: null }, { description: '' }] },
        { OR: [{ shortDescription: null }, { shortDescription: '' }] },
      ],
    },
  });
  const outOfStockBothEmpty = await prisma.product.count({
    where: {
      inStock: false,
      AND: [
        { OR: [{ description: null }, { description: '' }] },
        { OR: [{ shortDescription: null }, { shortDescription: '' }] },
      ],
    },
  });

  console.log(`${total} produit(s) au total.\n`);
  console.log(`Sans "description" (grand bloc, ne s'affiche pas du tout si vide) : ${noDescription} (${((noDescription / total) * 100).toFixed(1)}%)`);
  console.log(`Sans "shortDescription" (petit texte sous le bouton panier) : ${noShortDescription} (${((noShortDescription / total) * 100).toFixed(1)}%)`);
  console.log(`Sans LES DEUX (page quasi nue : titre + prix + stock uniquement) : ${bothEmpty} (${((bothEmpty / total) * 100).toFixed(1)}%)`);
  console.log(`  dont en rupture de stock : ${outOfStockBothEmpty}`);

  console.log('\n--- Vérification directe de quelques URLs vues dans le rapport "Soft 404" ---');
  for (const slug of SAMPLE_SLUGS) {
    const p = await prisma.product.findUnique({ where: { slug } });
    if (!p) {
      console.log(`  "${slug}" -> introuvable en base (peut-être un slug légèrement différent)`);
      continue;
    }
    console.log(
      `  "${slug}" -> description: ${textLength(p.description)} caractère(s), shortDescription: ${textLength(p.shortDescription)} caractère(s), en stock: ${p.inStock}`
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
