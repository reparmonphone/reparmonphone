// Diagnostic en lecture seule (aucune écriture) : cherche où le "- 2025" qui apparaît dans les
// résultats Google vient réellement de la base de données (et non du code, qui n'en contient plus
// aucune trace — vérifié dans generateMetadata() et layout.tsx).
//
// Vérifie deux sources possibles :
//   1. Le réglage global "seo_site_title" (table SiteSetting, modifiable dans /admin/seo) — c'est
//      lui qui apparaît sur la page d'accueil et sur toute page sans titre personnalisé.
//   2. Le champ "metaTitle" de chaque produit (modifiable fiche par fiche dans l'admin) — c'est lui
//      qui apparaît sur les fiches produit individuelles vues sur Google (ex: "Écran iPhone XR ... - 2025").
//
// Usage :
//   node scripts/diagnose-seo-year.js

require('dotenv').config({ path: require('path').join(__dirname, '../.env.migration') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- Réglage global "seo_site_title" (table SiteSetting) ---');
  const setting = await prisma.siteSetting.findFirst({ where: { key: 'seo_site_title' } });
  if (setting) {
    console.log(`Valeur actuelle : "${setting.value}"`);
    console.log(setting.value.includes('2025') ? '⚠️  Contient bien "2025".' : 'Ne contient pas "2025".');
  } else {
    console.log('Aucun réglage personnalisé — le site utilise la valeur par défaut du code (pas de "2025").');
  }

  console.log('\n--- Champ "metaTitle" des produits ---');
  const total = await prisma.product.count();
  const withYear = await prisma.product.findMany({
    where: { metaTitle: { contains: '2025' } },
    select: { id: true, title: true, metaTitle: true },
    take: 10,
  });
  const countWithYear = await prisma.product.count({ where: { metaTitle: { contains: '2025' } } });
  console.log(`${total} produit(s) au total, dont ${countWithYear} avec "2025" dans metaTitle.`);
  if (withYear.length > 0) {
    console.log('\nExemples (10 max) :');
    for (const p of withYear) {
      console.log(`  - "${p.title}" -> metaTitle: "${p.metaTitle}"`);
    }
  }

  console.log('\n--- Réglage global "seo_site_description" (pour info) ---');
  const desc = await prisma.siteSetting.findFirst({ where: { key: 'seo_site_description' } });
  console.log(desc ? `Valeur actuelle : "${desc.value}"` : 'Aucun réglage personnalisé (valeur par défaut du code).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
