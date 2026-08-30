/**
 * Diagnostic en LECTURE SEULE : liste tous les modèles de la gamme "iPhone" (marque Apple) dont
 * le nom contient "SE", pour comprendre pourquoi "iPhone SE (A1723 / A1662 / A1724)" (le SE
 * original de 2016) correspond à PLUSIEURS modèles une fois la référence entre parenthèses
 * ignorée (voir le rapport ❌ de scripts/import-iphone-products.js).
 *
 * N'écrit rien en base.
 *
 * Usage :
 *   node scripts/list-iphone-se-models.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function slugify(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}
function normalizeForComparison(s) {
  return slugify(s).replace(/-/g, '');
}
function stripParenthetical(s) {
  return s.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

async function main() {
  const brand = await prisma.brand.findUnique({ where: { slug: 'apple' } });
  if (!brand) {
    console.error('❌ Marque "apple" introuvable.');
    process.exit(1);
  }

  const lines = await prisma.productLine.findMany({
    where: { brandId: brand.id },
    include: { models: { include: { _count: { select: { products: true } } } } },
  });

  const line = lines.find((l) => l.name === 'iPhone') || lines.find((l) => normalizeForComparison(l.name) === 'iphone');
  if (!line) {
    console.error('❌ Gamme "iPhone" introuvable.');
    process.exit(1);
  }

  const seModels = line.models.filter((m) => /se/i.test(m.name));

  console.log(`Modèles de la gamme "${line.name}" contenant "SE" (${seModels.length}) :\n`);
  for (const m of seModels) {
    console.log(
      `   - id=${m.id}  name="${m.name}"  slug="${m.slug}"  produits=${m._count.products}  ` +
        `stripped-normalisé="${normalizeForComparison(stripParenthetical(m.name))}"`
    );
  }

  console.log('\nPour comparaison, le CSV attend une correspondance pour :');
  console.log('   "iPhone SE (A1723 / A1662 / A1724)" -> stripped-normalisé="' + normalizeForComparison(stripParenthetical('iPhone SE (A1723 / A1662 / A1724)')) + '"');
}

main()
  .catch((e) => {
    console.error('💥 Erreur :', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
