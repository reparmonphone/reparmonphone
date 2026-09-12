// Diagnostic en lecture seule : cherche "Pieces2Mobile" / "pieces2mobile.com" (nom de ton ancien
// fournisseur, probablement resté dans du texte importé automatiquement — même origine que "35 euros" /
// "Comptes professionnels" déjà corrigés) partout où du texte est stocké en base. Le code source (src/)
// a déjà été vérifié et ne contient aucune trace.
//
// Usage :
//   node scripts/find-pieces2mobile-mentions.js

require('dotenv').config({ path: require('path').join(__dirname, '../.env.migration') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const RE = /pieces2mobile(\.com)?/gi;

function findSnippets(text) {
  if (!text) return [];
  const hits = [];
  let m;
  RE.lastIndex = 0;
  while ((m = RE.exec(text)) !== null) {
    const start = Math.max(0, m.index - 60);
    const end = Math.min(text.length, m.index + m[0].length + 60);
    hits.push({ match: m[0], snippet: text.slice(start, end).replace(/\s+/g, ' ').trim() });
  }
  return hits;
}

async function main() {
  let total = 0;

  // ---- Produits (titre, descriptions courtes/longues, SEO) ----
  console.log('========== Produits (Product) — recherche en cours... ==========');
  const products = await prisma.product.findMany({
    select: { id: true, slug: true, title: true, shortDescription: true, description: true, metaTitle: true, metaDescription: true },
  });
  let productMatches = 0;
  const MAX_SHOWN = 15;
  const variantCounts = new Map();
  for (const p of products) {
    const fields = { title: p.title, shortDescription: p.shortDescription, description: p.description, metaTitle: p.metaTitle, metaDescription: p.metaDescription };
    let hitsThisProduct = 0;
    for (const [field, value] of Object.entries(fields)) {
      const hits = findSnippets(value);
      for (const h of hits) {
        total++;
        hitsThisProduct++;
        variantCounts.set(h.match, (variantCounts.get(h.match) || 0) + 1);
        if (productMatches < MAX_SHOWN) {
          console.log(`\n--- ${p.title} (/produit/${p.slug}) [${field}] ---`);
          console.log(`  "${h.match}" dans : ...${h.snippet}...`);
        }
      }
    }
    if (hitsThisProduct > 0) productMatches++;
  }
  console.log(`\nTotal produits concernés : ${productMatches}${productMatches > MAX_SHOWN ? ` (aperçu limité aux ${MAX_SHOWN} premiers)` : ''}`);
  console.log('Variantes de casse trouvées :', [...variantCounts.entries()].map(([v, c]) => `"${v}" (${c})`).join(', ') || '(aucune)');

  // ---- Pages de contenu ----
  console.log('\n========== Pages (Page) ==========');
  const pages = await prisma.page.findMany();
  let anyPage = false;
  for (const p of pages) {
    const hits = [...findSnippets(p.title), ...findSnippets(p.contentHtml)];
    if (hits.length === 0) continue;
    anyPage = true;
    console.log(`\n--- Page "${p.slug}" (${p.title}) ---`);
    for (const h of hits) {
      total++;
      console.log(`  "${h.match}" : ...${h.snippet}...`);
    }
  }
  if (!anyPage) console.log('(aucune mention)');

  // ---- Options de livraison ----
  console.log('\n========== Options de livraison (ShippingOption) ==========');
  const options = await prisma.shippingOption.findMany();
  let anyOption = false;
  for (const o of options) {
    const hits = [...findSnippets(o.label), ...findSnippets(o.description)];
    if (hits.length === 0) continue;
    anyOption = true;
    console.log(`\n--- "${o.label}" ---`);
    for (const h of hits) {
      total++;
      console.log(`  "${h.match}" : ...${h.snippet}...`);
    }
  }
  if (!anyOption) console.log('(aucune mention)');

  // ---- Réglages ----
  console.log('\n========== Réglages (SiteSetting) ==========');
  const settings = await prisma.siteSetting.findMany();
  let anySetting = false;
  for (const s of settings) {
    const hits = findSnippets(s.value);
    if (hits.length === 0) continue;
    anySetting = true;
    for (const h of hits) {
      total++;
      console.log(`  SiteSetting["${s.key}"] : "${h.match}" dans ...${h.snippet}...`);
    }
  }
  if (!anySetting) console.log('(aucune mention)');

  // ---- Guides de réparation ----
  console.log('\n========== Guides de réparation (RepairGuide + GuideStep) ==========');
  const guides = await prisma.repairGuide.findMany({ include: { steps: true } });
  let anyGuide = false;
  for (const g of guides) {
    const hits = [
      ...findSnippets(g.title),
      ...findSnippets(g.excerpt),
      ...findSnippets(g.metaTitle),
      ...findSnippets(g.metaDescription),
      ...g.steps.flatMap((s) => findSnippets(s.contentHtml).map((h) => ({ ...h, step: s.title }))),
    ];
    if (hits.length === 0) continue;
    anyGuide = true;
    console.log(`\n--- Guide "${g.title}" (/reparation/guide/${g.slug}) ---`);
    for (const h of hits) {
      total++;
      console.log(`  "${h.match}"${h.step ? ` [étape: ${h.step}]` : ''} : ...${h.snippet}...`);
    }
  }
  if (!anyGuide) console.log('(aucune mention)');

  // ---- Marques / gammes / modèles ----
  console.log('\n========== Catalogue (Brand / ProductLine / Model) ==========');
  const [brands, lines, models] = await Promise.all([
    prisma.brand.findMany(),
    prisma.productLine.findMany(),
    prisma.model.findMany(),
  ]);
  let anyCatalog = false;
  for (const b of brands) if (findSnippets(b.name).length) { anyCatalog = true; total++; console.log(`  Brand "${b.name}"`); }
  for (const l of lines) if (findSnippets(l.name).length) { anyCatalog = true; total++; console.log(`  ProductLine "${l.name}"`); }
  for (const m of models) if (findSnippets(m.name).length) { anyCatalog = true; total++; console.log(`  Model "${m.name}"`); }
  if (!anyCatalog) console.log('(aucune mention)');

  // ---- Partenaires / liens de référencement ----
  console.log('\n========== Partenaires & liens (Partner / ReferralLink) ==========');
  const [partners, referralLinks] = await Promise.all([prisma.partner.findMany(), prisma.referralLink.findMany()]);
  let anyPartner = false;
  for (const p of partners) {
    const hits = [...findSnippets(p.name), ...findSnippets(p.linkUrl)];
    if (hits.length) { anyPartner = true; total += hits.length; console.log(`  Partner "${p.name}" (${p.linkUrl})`); }
  }
  for (const r of referralLinks) {
    const hits = [...findSnippets(r.label), ...findSnippets(r.url)];
    if (hits.length) { anyPartner = true; total += hits.length; console.log(`  ReferralLink "${r.label}" (${r.url})`); }
  }
  if (!anyPartner) console.log('(aucune mention)');

  // ---- Avis produits ----
  console.log('\n========== Avis produits (ProductReview) ==========');
  const reviews = await prisma.productReview.findMany({ where: { text: { contains: 'pieces2mobile', mode: 'insensitive' } } });
  if (reviews.length === 0) {
    console.log('(aucune mention)');
  } else {
    for (const r of reviews) { total += 1; console.log(`  Avis de "${r.authorName}" : ...${findSnippets(r.text)[0]?.snippet}...`); }
  }

  console.log(`\n\n========== TOTAL : ${total} mention(s) "Pieces2Mobile" trouvée(s) au total. ==========`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
