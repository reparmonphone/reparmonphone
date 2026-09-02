// Scinde la gamme unique "iPad" (31 modèles Pro/Air/Mini/standard mélangés) en 4 vraies gammes
// distinctes sous la marque Apple : "iPad", "iPad Pro", "iPad Mini", "iPad Air" — comme c'était le
// cas avant. Une fois scindées, ce sont des gammes normales : renommables, réordonnables (glisser
// dans /admin/gammes), avec leur propre image, exactement comme iPhone ou Apple Watch. Le classement
// se fait par mot-clé dans le nom du modèle (Pro / Mini / Air / le reste = standard) ; l'ordre des
// modèles à l'intérieur de chaque nouvelle gamme reprend l'ordre déjà réglé dans l'ancienne gamme
// "iPad" (rien n'est perdu).
//
// Usage :
//   node scripts/split-ipad-lines.js            (aperçu, aucune écriture)
//   node scripts/split-ipad-lines.js --apply     (applique réellement les changements)

require('dotenv').config({ path: require('path').join(__dirname, '../.env.migration') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');

const NEW_LINES = {
  pro: {
    name: 'iPad Pro',
    slug: 'ipad-pro',
    imageUrl: 'https://bjfmbrexkkpgwufdqkoy.supabase.co/storage/v1/object/public/products/2025/03/pieces-detachees-coques-ipad-pro.jpg',
  },
  mini: {
    name: 'iPad Mini',
    slug: 'ipad-mini',
    imageUrl: 'https://bjfmbrexkkpgwufdqkoy.supabase.co/storage/v1/object/public/products/2025/03/coques-pieces-detachees-ipad-mini.jpg',
  },
  air: {
    name: 'iPad Air',
    slug: 'ipad-air',
    imageUrl: 'https://bjfmbrexkkpgwufdqkoy.supabase.co/storage/v1/object/public/products/2025/03/coques-pieces-detachees-ipad-air.jpg',
  },
};
const BASE_IMAGE_URL =
  'https://bjfmbrexkkpgwufdqkoy.supabase.co/storage/v1/object/public/products/2025/02/apple-ipad-1024x1024.png';

function classify(name) {
  const n = name.toLowerCase();
  if (n.includes('pro')) return 'pro';
  if (n.includes('mini')) return 'mini';
  if (n.includes('air')) return 'air';
  return 'base';
}

async function main() {
  const brand = await prisma.brand.findFirst({ where: { slug: 'apple' } });
  if (!brand) {
    console.error('❌ Marque "apple" introuvable.');
    process.exit(1);
  }

  const ipadLine = await prisma.productLine.findFirst({
    where: { brandId: brand.id, slug: 'ipad' },
    include: { models: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!ipadLine) {
    console.error('❌ Gamme "iPad" (slug "ipad") introuvable.');
    process.exit(1);
  }

  const buckets = { base: [], pro: [], mini: [], air: [] };
  for (const m of ipadLine.models) buckets[classify(m.name)].push(m);

  console.log(`Gamme "iPad" actuelle : ${ipadLine.models.length} modèle(s).\n`);
  for (const key of ['base', 'pro', 'mini', 'air']) {
    console.log(`${key === 'base' ? 'iPad (standard)' : NEW_LINES[key].name} : ${buckets[key].length} modèle(s)`);
    for (const m of buckets[key]) console.log(`  - ${m.name}`);
  }

  if (!APPLY) {
    console.log('\nAperçu uniquement — relance avec --apply pour créer les 3 nouvelles gammes et y déplacer les modèles.');
    return;
  }

  const maxSortOrder = await prisma.productLine.aggregate({
    where: { brandId: brand.id },
    _max: { sortOrder: true },
  });
  let nextSortOrder = (maxSortOrder._max.sortOrder ?? -1) + 1;

  const lineIdByBucket = { base: ipadLine.id };
  for (const key of ['pro', 'mini', 'air']) {
    const def = NEW_LINES[key];
    const line = await prisma.productLine.upsert({
      where: { brandId_slug: { brandId: brand.id, slug: def.slug } },
      update: {},
      create: { name: def.name, slug: def.slug, imageUrl: def.imageUrl, brandId: brand.id, sortOrder: nextSortOrder },
    });
    nextSortOrder += 1;
    lineIdByBucket[key] = line.id;
    console.log(`\n✅ Gamme "${def.name}" prête (id: ${line.id}).`);
  }

  if (!ipadLine.imageUrl) {
    await prisma.productLine.update({ where: { id: ipadLine.id }, data: { imageUrl: BASE_IMAGE_URL } });
  }

  for (const key of ['pro', 'mini', 'air']) {
    let order = 0;
    for (const m of buckets[key]) {
      await prisma.model.update({
        where: { id: m.id },
        data: { productLineId: lineIdByBucket[key], sortOrder: order },
      });
      order += 1;
    }
    console.log(`✅ ${buckets[key].length} modèle(s) déplacé(s) vers "${NEW_LINES[key].name}".`);
  }

  // Recompacte l'ordre des modèles restés dans "iPad" (standard), l'ordre relatif est conservé.
  let baseOrder = 0;
  for (const m of buckets.base) {
    await prisma.model.update({ where: { id: m.id }, data: { sortOrder: baseOrder } });
    baseOrder += 1;
  }

  console.log('\n🎉 Terminé. Les 4 gammes apparaissent maintenant séparément dans /admin/gammes sous Apple.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
