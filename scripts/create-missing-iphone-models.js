/**
 * Crée les modèles iPhone qui manquent encore en base, repérés par le rapport de
 * scripts/import-iphone-products.js (section ❌, hors le cas ambigu "iPhone SE (A1723/A1662/A1724)"
 * qui n'est PAS traité ici et reste à résoudre séparément).
 *
 * Les modèles sont créés SANS IMAGE (imageUrl reste vide) : les photos seront ajoutées plus tard
 * depuis /admin/gammes ou /admin/produits, comme cela a été fait pour Huawei.
 *
 * MODE DRY-RUN (recommandé en premier) :
 *   node scripts/create-missing-iphone-models.js --dry-run
 *
 * MODE RÉEL :
 *   node scripts/create-missing-iphone-models.js
 *
 * Une fois lancé, relance le dry-run de l'import iPhone pour vérifier que les produits
 * correspondants passent bien de ❌ à "à créer" :
 *   node scripts/import-iphone-products.js scripts/Iphone.csv --dry-run
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const isDryRun = process.argv.includes('--dry-run');

const BRAND_SLUG = 'apple';
const LINE_NAME = 'iPhone';

const MISSING_MODELS = [
  'iPhone 3G',
  'iPhone 3GS',
  'iPhone 12 Pro',
  'iPhone 17',
  'iPhone 17 Pro',
  'iPhone 17 Pro Max',
  'iPhone Air',
];

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

async function uniqueModelSlug(productLineId, name) {
  const base = slugify(name) || 'modele';
  let slug = base;
  let i = 1;
  while (await prisma.model.findFirst({ where: { productLineId, slug } })) {
    i += 1;
    slug = `${base}-${i}`;
  }
  return slug;
}

async function main() {
  console.log(isDryRun ? '🧪 MODE DRY-RUN — aucune écriture ne sera faite.\n' : '⚠️  MODE RÉEL — la base va être modifiée.\n');

  const brand = await prisma.brand.findUnique({ where: { slug: BRAND_SLUG } });
  if (!brand) {
    console.error(`❌ Marque introuvable en base (slug attendu : "${BRAND_SLUG}").`);
    process.exit(1);
  }

  const lines = await prisma.productLine.findMany({
    where: { brandId: brand.id },
    include: { models: true },
  });

  const line =
    lines.find((l) => l.name === LINE_NAME) ||
    lines.find((l) => normalizeForComparison(l.name) === normalizeForComparison(LINE_NAME));

  if (!line) {
    console.error(`❌ Gamme "${LINE_NAME}" introuvable sous la marque "${BRAND_SLUG}".`);
    process.exit(1);
  }

  console.log(`Gamme trouvée : "${line.name}" (slug "${line.slug}"), ${line.models.length} modèle(s) existant(s).\n`);

  let created = 0;
  let alreadyExist = 0;

  for (const modelName of MISSING_MODELS) {
    const existing = line.models.find((m) => normalizeForComparison(m.name) === normalizeForComparison(modelName));
    if (existing) {
      alreadyExist++;
      console.log(`   - "${modelName}" : existe déjà en base sous le nom "${existing.name}" — ignoré`);
      continue;
    }

    if (isDryRun) {
      console.log(`   - "${modelName}" : à créer (sans image)`);
      created++;
    } else {
      const slug = await uniqueModelSlug(line.id, modelName);
      await prisma.model.create({
        data: {
          name: modelName,
          slug,
          productLineId: line.id,
        },
      });
      console.log(`   - "${modelName}" : créé (slug "${slug}")`);
      created++;
    }
  }

  console.log('\n-------------------------------------------------------------');
  console.log(`Modèles ${isDryRun ? 'qui seraient créés' : 'créés'} : ${created}`);
  console.log(`Modèles déjà présents (ignorés) : ${alreadyExist}`);
  console.log('-------------------------------------------------------------\n');

  if (isDryRun) {
    console.log('Pour appliquer réellement, relance sans --dry-run :');
    console.log('   node scripts/create-missing-iphone-models.js\n');
  } else {
    console.log('✅ Terminé. Pense ensuite à relancer le dry-run de l\'import iPhone pour vérifier');
    console.log('   que les produits correspondants ne sont plus dans la section ❌ :');
    console.log('   node scripts/import-iphone-products.js scripts/Iphone.csv --dry-run\n');
  }
}

main()
  .catch((e) => {
    console.error('💥 Erreur :', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
