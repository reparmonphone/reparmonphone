// Diagnostic en lecture seule (aucune écriture) : après avoir lancé reorder-apple-lines.js --apply,
// la page /marque/apple affiche 6 cartes au lieu de 4 — "iPhones" et "iPads" (au pluriel, 0 produit)
// en plus des vraies cartes "iPhone" et "iPad" (avec les bons chiffres). Ce script liste TOUTES les
// gammes Apple telles qu'elles existent réellement en base (nom exact, slug, ordre), pour voir s'il y
// a un doublon caché (une gamme "iPhone" ET une autre "iPhones", par exemple) — même schéma que le
// doublon "Watch"/"Apple Watch" repéré plus tôt cette session.
//
// Usage :
//   node scripts/diagnose-apple-root-lines.js

require('dotenv').config({ path: require('path').join(__dirname, '../.env.migration') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const brand = await prisma.brand.findFirst({ where: { slug: 'apple' } });
  if (!brand) {
    console.error('❌ Marque "apple" introuvable.');
    process.exit(1);
  }

  const lines = await prisma.productLine.findMany({
    where: { brandId: brand.id },
    orderBy: { sortOrder: 'asc' },
    include: { _count: { select: { models: true } } },
  });

  console.log(`${lines.length} gamme(s) sous Apple :\n`);
  for (const l of lines) {
    console.log(`sortOrder ${l.sortOrder} — "${l.name}" (id: ${l.id}, slug: "${l.slug}", ${l._count.models} modèle(s))`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
