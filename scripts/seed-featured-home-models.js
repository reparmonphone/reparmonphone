// Coche ⭐ (Model.featuredOnHome) un premier lot de modèles "récents" pour démarrer la sélection
// "Vedette" de la page d'accueil (voir TopProduitsSection.tsx et le nouveau bouton ⭐ dans
// /admin/gammes) — reprend la liste donnée par Krys suite au retour d'audit : iPhone 15, 14, 13, 12,
// 11 (et donc "iPhone 14 Pro" au passage, inclus dans "iPhone 14"), Galaxy A15/16/25/26/35/55 et
// Galaxy S22/23/24. Point de départ raisonnable, entièrement modifiable ensuite depuis /admin/gammes
// (case ⭐ à côté de chaque modèle) — ce script ne fait que cocher, jamais décocher un modèle déjà
// sélectionné manuellement, et ne touche à aucun produit.
//
// Usage :
//   node scripts/seed-featured-home-models.js            (aperçu, aucune écriture)
//   node scripts/seed-featured-home-models.js --apply     (applique réellement la sélection)

require('dotenv').config({ path: require('path').join(__dirname, '../.env.migration') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');

const RULES = [
  { brandSlug: 'apple', contains: ['iPhone 15', 'iPhone 14', 'iPhone 13', 'iPhone 12', 'iPhone 11'] },
  { brandSlug: 'samsung', contains: ['A15', 'A16', 'A25', 'A26', 'A35', 'A55', 'S22', 'S23', 'S24'] },
];

async function main() {
  let totalMatched = 0;
  let totalNewlyFeatured = 0;

  for (const rule of RULES) {
    const brand = await prisma.brand.findFirst({ where: { slug: rule.brandSlug } });
    if (!brand) {
      console.log(`⚠️  Marque "${rule.brandSlug}" introuvable — ignorée.`);
      continue;
    }

    const models = await prisma.model.findMany({
      where: {
        productLine: { brandId: brand.id },
        OR: rule.contains.map((c) => ({ name: { contains: c, mode: 'insensitive' } })),
      },
      select: { id: true, name: true, featuredOnHome: true },
    });

    console.log(`\n${brand.name} — ${models.length} modèle(s) correspondant(s) :`);
    for (const m of models) {
      console.log(`  ${m.featuredOnHome ? '★ déjà coché' : '☆ → sera coché'} — ${m.name}`);
    }
    totalMatched += models.length;
    totalNewlyFeatured += models.filter((m) => !m.featuredOnHome).length;

    if (APPLY) {
      const idsToUpdate = models.filter((m) => !m.featuredOnHome).map((m) => m.id);
      if (idsToUpdate.length > 0) {
        await prisma.model.updateMany({ where: { id: { in: idsToUpdate } }, data: { featuredOnHome: true } });
      }
    }
  }

  console.log(`\n${totalMatched} modèle(s) au total, dont ${totalNewlyFeatured} nouvellement coché(s).`);
  if (!APPLY) {
    console.log('\nAperçu uniquement — relance avec --apply pour cocher réellement ces modèles.');
  } else {
    console.log('\n✅ Sélection appliquée.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
