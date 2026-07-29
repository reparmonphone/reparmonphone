/**
 * Renseigne automatiquement l'image de couverture des guides de réparation, en réutilisant :
 *   1. En priorité : l'image du modèle déjà présente dans data/category_content.json (les icônes
 *      utilisées sur les pages de navigation /marque/[brand]/[gamme], déjà migrées vers Supabase
 *      Storage — donc aucun risque de droit d'auteur, ce sont tes propres assets hébergés).
 *   2. En repli, si aucune correspondance trouvée : la photo d'un produit "reconditionné complet"
 *      du même modèle, s'il y en a un en vente.
 *
 * Idempotent : relançable sans risque, ne fait que compléter les coverImageUrl manquantes
 * (n'écrase jamais une image déjà définie manuellement).
 *
 * USAGE :
 *   node scripts/set-guide-cover-images.js --dry-run   (aperçu, sans écriture)
 *   node scripts/set-guide-cover-images.js              (application réelle)
 */

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const isDryRun = process.argv.includes('--dry-run');

const CATEGORY_CONTENT_FILE = path.join(__dirname, '../data/category_content.json');

function slugify(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function lastPathSegment(url) {
  const clean = url.replace(/\/$/, '');
  const parts = clean.split('/');
  return parts[parts.length - 1] || '';
}

// Construit une table de correspondance "slug ou nom normalisé -> imageUrl" à partir de toutes les
// cartes de modèles trouvées dans category_content.json (toutes catégories confondues).
function buildImageMapFromCategoryContent() {
  const map = new Map(); // clé normalisée -> imageUrl

  if (!fs.existsSync(CATEGORY_CONTENT_FILE)) {
    console.warn(`⚠️  Fichier introuvable : ${CATEGORY_CONTENT_FILE} — cette source sera ignorée.`);
    return map;
  }

  const categoryContent = JSON.parse(fs.readFileSync(CATEGORY_CONTENT_FILE, 'utf-8'));

  for (const content of Object.values(categoryContent)) {
    for (const card of content.cards || []) {
      if (!card.imageUrl) continue;
      const bySlug = slugify(lastPathSegment(card.href));
      const byName = slugify(card.name);
      if (bySlug && !map.has(bySlug)) map.set(bySlug, card.imageUrl);
      if (byName && !map.has(byName)) map.set(byName, card.imageUrl);
    }
  }

  return map;
}

async function main() {
  const categoryImageMap = buildImageMapFromCategoryContent();
  console.log(`📄 ${categoryImageMap.size} correspondances chargées depuis category_content.json.\n`);

  const guides = await prisma.repairGuide.findMany({
    where: { modelId: { not: null }, coverImageUrl: null },
    select: { id: true, title: true, modelId: true },
  });

  console.log(`🔍 ${guides.length} guide(s) sans image de couverture, à traiter.\n`);

  const modelIds = [...new Set(guides.map((g) => g.modelId))];
  const models = await prisma.model.findMany({
    where: { id: { in: modelIds } },
    select: { id: true, slug: true, name: true },
  });
  const modelById = new Map(models.map((m) => [m.id, m]));

  let matchedFromCategory = 0;
  let matchedFromReconditioned = 0;
  let unmatched = 0;

  for (const modelId of modelIds) {
    const model = modelById.get(modelId);
    const guidesForModel = guides.filter((g) => g.modelId === modelId);
    if (!model) {
      unmatched += guidesForModel.length;
      continue;
    }

    // 1. Priorité : image trouvée dans category_content.json (par slug, puis par nom normalisé)
    let imageUrl = categoryImageMap.get(slugify(model.slug)) || categoryImageMap.get(slugify(model.name));
    let source = 'category_content.json';

    // 2. Repli : photo d'un produit "reconditionné" du même modèle
    if (!imageUrl) {
      const reconditionedProduct = await prisma.product.findFirst({
        where: { modelId, title: { contains: 'reconditionn', mode: 'insensitive' }, imageUrl: { not: null } },
        select: { imageUrl: true },
      });
      if (reconditionedProduct) {
        imageUrl = reconditionedProduct.imageUrl;
        source = 'produit reconditionné';
      }
    }

    if (!imageUrl) {
      unmatched += guidesForModel.length;
      continue;
    }

    console.log(`✅ ${model.name} — image trouvée via ${source} → ${guidesForModel.length} guide(s)`);
    if (source === 'category_content.json') matchedFromCategory += guidesForModel.length;
    else matchedFromReconditioned += guidesForModel.length;

    if (!isDryRun) {
      await prisma.repairGuide.updateMany({
        where: { id: { in: guidesForModel.map((g) => g.id) } },
        data: { coverImageUrl: imageUrl },
      });
    }
  }

  console.log('\n──────────────────────────────');
  console.log(`Guides avec image (via category_content.json) : ${matchedFromCategory}`);
  console.log(`Guides avec image (via produit reconditionné) : ${matchedFromReconditioned}`);
  console.log(`Guides restant sans image : ${unmatched}`);
  console.log('──────────────────────────────\n');

  if (isDryRun) {
    console.log('Pour appliquer réellement, relance sans --dry-run :');
    console.log('   node scripts/set-guide-cover-images.js\n');
  }
}

main()
  .catch((e) => {
    console.error('💥 Erreur :', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
