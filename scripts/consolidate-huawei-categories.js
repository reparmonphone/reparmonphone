/**
 * 1) Fusionne réellement en base les lignes "P", "Huawei P" et "Série P" (créées séparément
 *    par erreur) en une seule ligne "P" — réattribue modèles et produits, sans rien perdre.
 * 2) Reconstruit entièrement la section "Huawei" de data/category_content.json à partir des
 *    vraies données Prisma : une carte "Gamme X" par ligne réelle, avec des compteurs calculés
 *    précisément par identifiant (pas par recherche floue sur le nom, qui donnait des chiffres
 *    aberrants comme "343 produits" pour la carte générique "Huawei").
 *
 * Résultat final : Gamme P, Gamme G, Gamme Mate, Gamme Nova, Gamme Y, Gamme Ascend, Autres, Huawei.
 *
 * MODE DRY-RUN (fortement recommandé en premier) :
 *   node scripts/consolidate-huawei-categories.js --dry-run
 *
 * MODE RÉEL :
 *   node scripts/consolidate-huawei-categories.js
 */

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const isDryRun = process.argv.includes('--dry-run');
const CATEGORY_CONTENT_FILE = path.join(__dirname, '../data/category_content.json');
const BACKUP_FILE = path.join(__dirname, `../data/category_content.backup-huawei-consolidate-${Date.now()}.json`);

const DISPLAY_LABELS = {
  P: 'Gamme P',
  G: 'Gamme G',
  Mate: 'Gamme Mate',
  Nova: 'Gamme Nova',
  Y: 'Gamme Y',
  Ascend: 'Gamme Ascend',
  Autres: 'Autres',
  Huawei: 'Huawei',
};

function slugify(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function mergeLines(brandId) {
  const canonical = await prisma.productLine.findFirst({ where: { brandId, name: 'P' } });
  if (!canonical) {
    console.log('⚠️  Ligne "P" introuvable — fusion ignorée.');
    return;
  }

  const toMergeNames = ['Huawei P', 'Série P'];
  for (const name of toMergeNames) {
    const line = await prisma.productLine.findFirst({
      where: { brandId, name },
      include: { models: { include: { products: true } } },
    });
    if (!line) {
      console.log(`   - "${name}" introuvable, rien à fusionner.`);
      continue;
    }

    console.log(`\n📦 Fusion de "${name}" (${line.models.length} modèle(s)) vers "P" :`);
    for (const model of line.models) {
      const existing = await prisma.model.findFirst({
        where: { productLineId: canonical.id, name: { equals: model.name, mode: 'insensitive' } },
      });
      if (existing) {
        console.log(`   - Modèle "${model.name}" existe déjà sous "P" → réattribution de ${model.products.length} produit(s) vers ce modèle existant`);
        if (!isDryRun) {
          await prisma.product.updateMany({ where: { modelId: model.id }, data: { modelId: existing.id } });
          await prisma.model.delete({ where: { id: model.id } });
        }
      } else {
        console.log(`   - Modèle "${model.name}" déplacé tel quel sous "P" (${model.products.length} produit(s))`);
        if (!isDryRun) {
          await prisma.model.update({ where: { id: model.id }, data: { productLineId: canonical.id } });
        }
      }
    }
    if (!isDryRun) {
      await prisma.productLine.delete({ where: { id: line.id } });
    }
    console.log(`   ✅ "${name}" ${isDryRun ? 'serait supprimée' : 'supprimée'} (vidée de son contenu)`);
  }
}

async function rebuildCategoryContent(brandId) {
  const lines = await prisma.productLine.findMany({
    where: { brandId },
    include: {
      models: {
        include: { products: { where: { showInBoutique: true }, select: { id: true, imageUrl: true } } },
      },
    },
  });

  const topCards = [];
  const subSections = {};

  for (const line of lines) {
    const displayName = DISPLAY_LABELS[line.name] || line.name;
    const key = `huawei-line-${slugify(line.name)}`;
    const allProducts = line.models.flatMap((m) => m.products);
    const totalCount = allProducts.length;
    const representativeImage = allProducts.find((p) => p.imageUrl)?.imageUrl || null;

    console.log(`   - ${displayName} (base: "${line.name}") → ${line.models.length} modèle(s), ${totalCount} produit(s)`);

    topCards.push({
      name: displayName,
      imageUrl: representativeImage,
      href: `https://www.reparmonphone.fr/marque/huawei/${key}/`,
      count: null,
      liveCount: totalCount,
    });

    const modelCards = line.models.map((model) => {
      const img = model.products.find((p) => p.imageUrl)?.imageUrl || representativeImage;
      return {
        name: model.name,
        imageUrl: img,
        href: `https://www.reparmonphone.fr/marque/huawei/${key}/${slugify(model.name)}/`,
        count: model.products.length,
        liveCount: model.products.length,
      };
    });

    subSections[key] = { title: displayName, description: null, cards: modelCards };
  }

  return { topCards, subSections };
}

async function main() {
  console.log(isDryRun ? '🧪 MODE DRY-RUN — aucune écriture ne sera faite.\n' : '⚠️  MODE RÉEL — la base et le fichier vont être modifiés.\n');

  const brand = await prisma.brand.findUnique({ where: { slug: 'huawei' } });
  if (!brand) {
    console.error('❌ Marque "Huawei" introuvable.');
    process.exit(1);
  }

  console.log('=== ÉTAPE 1 : Fusion des lignes dupliquées ===');
  await mergeLines(brand.id);

  console.log('\n=== ÉTAPE 2 : Reconstruction de la section Huawei ===');
  const { topCards, subSections } = await rebuildCategoryContent(brand.id);

  console.log(`\n${isDryRun ? 'Structure finale qui serait écrite' : 'Structure finale écrite'} : ${topCards.length} carte(s) au niveau Huawei\n`);

  if (!isDryRun) {
    const categoryContent = JSON.parse(fs.readFileSync(CATEGORY_CONTENT_FILE, 'utf-8'));
    fs.copyFileSync(CATEGORY_CONTENT_FILE, BACKUP_FILE);

    // Retire toutes les anciennes clés liées à Huawei créées par les scripts précédents
    // aujourd'hui (huawei-p, huawei-g, huawei-nova, huawei-y, huawei-ascend, huawei-autres,
    // huawei-mate) pour repartir propre, sans laisser de sections orphelines inutilisées.
    Object.keys(categoryContent).forEach((k) => {
      if (k.startsWith('huawei-') && k !== 'huawei') delete categoryContent[k];
    });

    categoryContent['huawei'] = {
      ...categoryContent['huawei'],
      cards: topCards,
    };
    Object.assign(categoryContent, subSections);

    fs.writeFileSync(CATEGORY_CONTENT_FILE, JSON.stringify(categoryContent, null, 2), 'utf-8');
    console.log(`💾 Sauvegarde : ${BACKUP_FILE}`);
    console.log(`✅ Fichier mis à jour : ${CATEGORY_CONTENT_FILE}`);
  } else {
    console.log('Pour appliquer réellement, relance sans --dry-run :');
    console.log('   node scripts/consolidate-huawei-categories.js\n');
  }
}

main()
  .catch((e) => {
    console.error('💥 Erreur :', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
