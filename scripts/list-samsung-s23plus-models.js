/**
 * Diagnostic en lecture seule : liste tous les modèles de la gamme "Galaxy S" contenant "23"
 * en base, avec leurs clés de comparaison normalisées (identiques à la logique de
 * scripts/import-samsung-products.js et scripts/create-missing-samsung-categories.js), pour
 * comprendre pourquoi le CSV "S23+ (S916B) / (S916U)" est jugé ambigu ("sans référence").
 *
 *   node scripts/list-samsung-s23plus-models.js
 */

const path = require('path');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: path.join(__dirname, '../.env.migration') });

const prisma = new PrismaClient();

function slugify(s) {
  return s
    .replace(/\+/g, ' plus ')
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
  return s.replace(/\s*\([^)]*\)/g, '').replace(/\s{2,}/g, ' ').trim();
}

async function main() {
  const line = await prisma.productLine.findFirst({
    where: { name: 'Galaxy S', brand: { slug: 'samsung' } },
    include: { models: true },
  });
  if (!line) {
    console.error('Gamme "Galaxy S" introuvable.');
    process.exit(1);
  }

  const target = 'S23+ (S916B) / (S916U)';
  const targetStripped = normalizeForComparison(stripParenthetical(target));
  console.log(`CSV : "${target}"`);
  console.log(`-> nom sans référence, normalisé : "${targetStripped}"\n`);

  console.log(`Modèles "Galaxy S" contenant "23" en base :\n`);
  for (const m of line.models) {
    if (!m.name.includes('23')) continue;
    const stripped = normalizeForComparison(stripParenthetical(m.name));
    const match = stripped === targetStripped ? '  <-- MATCH avec le CSV ci-dessus' : '';
    console.log(`   id=${m.id}  name="${m.name}"  slug="${m.slug}"  stripped="${stripped}"${match}`);
  }
}

main().finally(() => prisma.$disconnect());
