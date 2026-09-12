// Diagnostic en lecture seule (aucune écriture) : recherche partout dans la base de données où pourrait
// se trouver la mention "Envoi gratuit dès 35€" que Krys veut supprimer (remplacée par la vraie règle :
// livraison gratuite dès 250€ TTC en France métropolitaine). Le code source (src/) a déjà été vérifié
// intégralement et ne contient aucune trace de "35€" — cette mention est donc forcément stockée en base
// (page de contenu éditable, description produit, option de livraison...).
//
// Usage :
//   node scripts/find-free-shipping-mentions.js

require('dotenv').config({ path: require('path').join(__dirname, '../.env.migration') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Cherche "35" suivi (de près) d'un €, ou l'inverse, ou "35 euros" — pour éviter les faux positifs du
// type "prix : 35,00 €" qui n'ont rien à voir avec un seuil de livraison, on cherche aussi le mot
// "gratuit"/"livraison"/"frais de port"/"port" à proximité (dans les 60 caractères autour).
const RE_35 = /35[\s ]*(€|euros?)|(€|euros?)[\s ]*35/gi;
const RE_CONTEXT = /(gratuit|livraison|frais de port|\bport\b|exp[ée]di)/i;

function findSnippets(text, label) {
  if (!text) return [];
  const hits = [];
  let m;
  RE_35.lastIndex = 0;
  while ((m = RE_35.exec(text)) !== null) {
    const start = Math.max(0, m.index - 60);
    const end = Math.min(text.length, m.index + m[0].length + 60);
    const snippet = text.slice(start, end).replace(/\s+/g, ' ').trim();
    hits.push({ label, snippet, hasShippingContext: RE_CONTEXT.test(snippet) });
  }
  return hits;
}

async function main() {
  let totalHits = 0;

  console.log('========== 1) Options de livraison (ShippingOption) ==========');
  const options = await prisma.shippingOption.findMany({ orderBy: { order: 'asc' } });
  if (options.length === 0) console.log('(aucune option)');
  for (const o of options) {
    console.log(`- [${o.active ? 'active' : 'masquée'}] "${o.label}" — ${o.price}€ — description: ${o.description ?? '(vide)'}`);
    for (const h of [...findSnippets(o.label, 'label'), ...findSnippets(o.description, 'description')]) {
      totalHits++;
      console.log(`  ⚠️  MATCH "35€" dans ${h.label} : ...${h.snippet}...`);
    }
  }

  console.log('\n========== 2) Pages de contenu (Page) ==========');
  const pages = await prisma.page.findMany();
  for (const p of pages) {
    const hits = findSnippets(p.contentHtml, 'contentHtml');
    if (hits.length === 0) continue;
    console.log(`\n--- Page "${p.slug}" (${p.title}) ---`);
    for (const h of hits) {
      totalHits++;
      console.log(`  ⚠️  MATCH "35€"${h.hasShippingContext ? ' [contexte livraison]' : ''} : ...${h.snippet}...`);
    }
  }
  if (pages.every((p) => findSnippets(p.contentHtml, 'x').length === 0)) console.log('(aucune mention "35€" dans les pages)');

  console.log('\n========== 3) Réglages (SiteSetting) ==========');
  const settings = await prisma.siteSetting.findMany();
  let anySetting = false;
  for (const s of settings) {
    const hits = findSnippets(s.value, 'value');
    if (hits.length === 0) continue;
    anySetting = true;
    for (const h of hits) {
      totalHits++;
      console.log(`  ⚠️  MATCH "35€" dans SiteSetting["${s.key}"] : ...${h.snippet}...`);
    }
  }
  if (!anySetting) console.log('(aucune mention "35€" dans les réglages)');

  console.log('\n========== 4) Descriptions produits (Product) — recherche en cours... ==========');
  // Gros volume (plusieurs centaines de produits) : on ne charge que les colonnes texte nécessaires.
  const products = await prisma.product.findMany({
    select: { id: true, slug: true, title: true, shortDescription: true, description: true },
  });
  let productMatches = 0;
  const MAX_SHOWN = 20;
  for (const p of products) {
    const hits = [
      ...findSnippets(p.shortDescription, 'shortDescription'),
      ...findSnippets(p.description, 'description'),
    ];
    if (hits.length === 0) continue;
    productMatches++;
    totalHits += hits.length;
    if (productMatches <= MAX_SHOWN) {
      console.log(`\n--- Produit "${p.title}" (/produit/${p.slug}) ---`);
      for (const h of hits) {
        console.log(`  ⚠️  MATCH "35€" dans ${h.label}${h.hasShippingContext ? ' [contexte livraison]' : ''} : ...${h.snippet}...`);
      }
    }
  }
  if (productMatches === 0) {
    console.log('(aucune mention "35€" dans les descriptions produits)');
  } else if (productMatches > MAX_SHOWN) {
    console.log(`\n... et ${productMatches - MAX_SHOWN} autres produits concernés (sur ${productMatches} au total) — liste tronquée.`);
  }

  console.log(`\n========== TOTAL : ${totalHits} mention(s) "35€" trouvée(s) au total. ==========`);
  if (totalHits === 0) {
    console.log('Aucune mention trouvée dans la base non plus. La mention "35€" est peut-être :');
    console.log('  - dans une image (bannière, visuel promo) plutôt que du texte,');
    console.log('  - dans un email déjà envoyé (pas un problème à corriger),');
    console.log('  - ou ailleurs (Google Merchant Center, réseaux sociaux...) plutôt que sur le site lui-même.');
    console.log('Dans ce cas, dis-moi où exactement tu la vois (capture d\'écran + URL) pour qu\'on la corrige.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
