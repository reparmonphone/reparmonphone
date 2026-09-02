// Range les gammes Apple dans /admin/gammes dans un ordre logique : iPhone, puis les 4 catégories
// iPad regroupées ensemble (iPad, iPad Pro, iPad Mini, iPad Air — dans cet ordre, comme demandé),
// puis AirPods et Apple Watch. Aujourd'hui elles sont mélangées (iPad Pro se retrouve avant AirPods
// et Apple Watch, iPad Mini/Air après) parce que scripts/split-ipad-lines.js les avait ajoutées à la
// fin de la liste au lieu de les placer à côté de "iPad". Ne touche à rien d'autre (aucun modèle,
// aucun produit) — uniquement l'ordre d'affichage des gammes.
//
// Usage :
//   node scripts/reorder-apple-lines.js            (aperçu, aucune écriture)
//   node scripts/reorder-apple-lines.js --apply     (applique réellement les changements)

require('dotenv').config({ path: require('path').join(__dirname, '../.env.migration') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');

// Ordre voulu, identifié par slug si connu, sinon par nom (au cas où le slug diffère de ce qu'on
// suppose) — voir la résolution ci-dessous qui essaie les deux.
const DESIRED_ORDER = [
  { slug: 'iphone', name: 'iPhone' },
  { slug: 'ipad', name: 'iPad' },
  { slug: 'ipad-pro', name: 'iPad Pro' },
  { slug: 'ipad-mini', name: 'iPad Mini' },
  { slug: 'ipad-air', name: 'iPad Air' },
  { slug: 'airpods', name: 'AirPods' },
  { slug: 'apple-watch', name: 'Apple Watch' },
];

async function main() {
  const brand = await prisma.brand.findFirst({ where: { slug: 'apple' } });
  if (!brand) {
    console.error('❌ Marque "apple" introuvable.');
    process.exit(1);
  }

  const lines = await prisma.productLine.findMany({ where: { brandId: brand.id }, orderBy: { sortOrder: 'asc' } });

  console.log('Ordre actuel :');
  lines.forEach((l) => console.log(`  ${l.sortOrder} — ${l.name} (slug: ${l.slug})`));

  const bySlug = new Map(lines.map((l) => [l.slug, l]));
  const byName = new Map(lines.map((l) => [l.name.toLowerCase(), l]));

  const ordered = [];
  const usedIds = new Set();
  for (const target of DESIRED_ORDER) {
    const line = bySlug.get(target.slug) ?? byName.get(target.name.toLowerCase());
    if (!line) {
      console.log(`⚠️  Gamme "${target.name}" introuvable (ni par slug "${target.slug}", ni par nom) — ignorée.`);
      continue;
    }
    ordered.push(line);
    usedIds.add(line.id);
  }
  // Toute autre gamme Apple non listée ci-dessus (improbable) garde son ordre relatif, à la suite.
  for (const l of lines) {
    if (!usedIds.has(l.id)) ordered.push(l);
  }

  console.log('\nNouvel ordre :');
  ordered.forEach((l, i) => console.log(`  ${i} — ${l.name}`));

  if (!APPLY) {
    console.log('\nAperçu uniquement — relance avec --apply pour appliquer ce nouvel ordre.');
    return;
  }

  await prisma.$transaction(
    ordered.map((l, index) => prisma.productLine.update({ where: { id: l.id }, data: { sortOrder: index } }))
  );

  console.log('\n✅ Ordre mis à jour.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
