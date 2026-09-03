// Cherche dans toute la base (fiches produit, pages de contenu, réglages SEO du site) des formulations
// marketing invérifiables du type "leader", "grossiste", "numéro 1", "premier fournisseur"... signalées
// par un retour d'audit externe ("principal grossiste en pièces de rechange pour mobiles en Europe",
// "leader en vente de pièces détachées"). Lecture seule — affiche où ça se trouve et combien de fois,
// pour décider quoi corriger avant d'écrire un script de correction ciblé.
//
// Usage :
//   node scripts/diagnose-aggressive-seo-claims.js

require('dotenv').config({ path: require('path').join(__dirname, '../.env.migration') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Motifs à repérer (insensible à la casse) — volontairement larges pour ne rien manquer, à affiner
// ensuite à l'oeil sur les résultats.
const PATTERNS = [
  /grossiste/i,
  /leader/i,
  /num[ée]ro\s*1\b/i,
  /n°\s*1\b/i,
  /premier\s+(fournisseur|distributeur|vendeur)/i,
  /principal\s+(fournisseur|distributeur|acteur|grossiste)/i,
  /le\s+plus\s+grand/i,
];

function matchedPatterns(text) {
  return PATTERNS.filter((p) => p.test(text)).map((p) => p.source);
}

async function main() {
  // 1) Réglages SEO globaux (/admin/seo) — titre & description du site
  const settings = await prisma.siteSetting.findMany({
    where: { key: { in: ['seo_site_title', 'seo_site_description'] } },
  });
  console.log('=== Réglages SEO du site (/admin/seo) ===');
  for (const s of settings) {
    const hits = matchedPatterns(s.value);
    if (hits.length) {
      console.log(`⚠️  ${s.key} : "${s.value}"  [motifs: ${hits.join(', ')}]`);
    } else {
      console.log(`✅ ${s.key} : rien de suspect`);
    }
  }

  // 2) Pages de contenu éditables (à propos, mentions légales, CGV, livraison...)
  console.log('\n=== Pages de contenu (table Page) ===');
  const pages = await prisma.page.findMany({ select: { slug: true, title: true, contentHtml: true } });
  let pageHits = 0;
  for (const p of pages) {
    const hits = matchedPatterns(p.contentHtml);
    if (hits.length) {
      pageHits++;
      console.log(`⚠️  /${p.slug} ("${p.title}") — motifs: ${hits.join(', ')}`);
      // Affiche un extrait autour de la première occurrence pour contexte
      const idx = p.contentHtml.search(PATTERNS.find((pat) => pat.test(p.contentHtml)));
      console.log(`    …${p.contentHtml.slice(Math.max(0, idx - 80), idx + 120).replace(/\s+/g, ' ')}…`);
    }
  }
  if (pageHits === 0) console.log('✅ Aucune page suspecte.');

  // 3) Descriptions produit (description longue affichée sous la fiche) — potentiellement des milliers
  // de fiches si c'est un texte "collé" à l'import, d'où l'intérêt de compter avant de corriger.
  console.log('\n=== Descriptions produit (Product.description) ===');
  const products = await prisma.product.findMany({
    where: { description: { not: null } },
    select: { id: true, slug: true, title: true, description: true },
  });
  const productHits = products.filter((p) => p.description && matchedPatterns(p.description).length > 0);
  console.log(`${products.length} produit(s) avec une description longue, dont ${productHits.length} avec un motif suspect.`);
  if (productHits.length > 0) {
    // Regarde si c'est un texte répété à l'identique (boilerplate collé partout) ou du cas par cas
    const uniqueDescriptions = new Set(productHits.map((p) => p.description.trim()));
    console.log(`  → ${uniqueDescriptions.size} texte(s) unique(s) parmi ces ${productHits.length} fiches.`);
    console.log('\n  Exemples (5 max) :');
    for (const p of productHits.slice(0, 5)) {
      const hits = matchedPatterns(p.description);
      const idx = p.description.search(PATTERNS.find((pat) => pat.test(p.description)));
      console.log(`  - [${p.slug}] "${p.title}" — motifs: ${hits.join(', ')}`);
      console.log(`    …${p.description.slice(Math.max(0, idx - 80), idx + 120).replace(/\s+/g, ' ')}…`);
    }
  }

  console.log('\nTerminé — aucune modification effectuée (lecture seule).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
