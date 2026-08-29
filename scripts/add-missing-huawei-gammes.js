/**
 * Ajoute dans data/category_content.json les gammes Huawei manquantes (créées via un import
 * fournisseur mais absentes du fichier statique de contenu) : la carte de la gamme sur la page
 * /marque/huawei, ET la sous-page listant ses modèles quand on clique dessus.
 *
 * MODE DRY-RUN (recommandé en premier) :
 *   node scripts/add-missing-huawei-gammes.js --dry-run
 *
 * MODE RÉEL :
 *   node scripts/add-missing-huawei-gammes.js
 */

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const isDryRun = process.argv.includes('--dry-run');
const CATEGORY_CONTENT_FILE = path.join(__dirname, '../data/category_content.json');
const BACKUP_FILE = path.join(__dirname, '../data/category_content.backup-huawei.json');
const BRAND_KEY_CANDIDATES = ['huawei', 'Huawei'];

function slugify(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function main() {
  if (!fs.existsSync(CATEGORY_CONTENT_FILE)) {
    console.error(`Fichier introuvable : ${CATEGORY_CONTENT_FILE}`);
    process.exit(1);
  }
  const categoryContent = JSON.parse(fs.readFileSync(CATEGORY_CONTENT_FILE, 'utf-8'));

  let brandKey = null;
  for (const key of BRAND_KEY_CANDIDATES) {
    if (categoryContent[key]) {
      brandKey = key;
      break;
    }
  }
  if (!brandKey) {
    console.error('Section "huawei" introuvable dans le fichier. Clés disponibles (premières 30) :');
    console.error(Object.keys(categoryContent).slice(0, 30).join(', '));
    process.exit(1);
  }
  console.log(`Section marque trouvée sous la clé "${brandKey}".\n`);

  const existingGammeNames = new Set(categoryContent[brandKey].cards.map((c) => c.name.trim().toLowerCase()));

  const brand = await prisma.brand.findUnique({ where: { slug: 'huawei' } });
  if (!brand) {
    console.error('Marque "Huawei" introuvable en base.');
    process.exit(1);
  }

  const lines = await prisma.productLine.findMany({
    where: { brandId: brand.id },
    include: {
      models: {
        include: { products: { where: { showInBoutique: true }, select: { id: true, slug: true, imageUrl: true } } },
      },
    },
  });

  const missingLines = lines.filter((l) => !existingGammeNames.has(l.name.trim().toLowerCase()));

  console.log(`${lines.length} gamme(s) en base sous "Huawei", dont ${missingLines.length} absente(s) du fichier :\n`);

  const newTopCards = [];
  const newSections = {};

  for (const line of missingLines) {
    const key = `huawei-${slugify(line.name)}`;
    const totalProducts = line.models.reduce((sum, m) => sum + m.products.length, 0);
    const representativeImage =
      line.models.flatMap((m) => m.products).find((p) => p.imageUrl)?.imageUrl || null;

    console.log(`   - ${line.name} -> clé "${key}", ${line.models.length} modèle(s), ${totalProducts} produit(s) au total`);

    // Carte de la gamme, affichée sur /marque/huawei (carte "branche" : count=null car une
    // sous-page existe désormais pour cette clé)
    newTopCards.push({
      name: line.name,
      imageUrl: representativeImage,
      href: `https://www.reparmonphone.fr/marque/huawei/${key}/`,
      count: null,
    });

    // Sous-page listant chaque modèle de cette gamme, avec son propre compteur de produits
    const modelCards = line.models.map((model) => {
      const modelRepImage = model.products.find((p) => p.imageUrl)?.imageUrl || representativeImage;
      return {
        name: model.name,
        imageUrl: modelRepImage,
        href: `https://www.reparmonphone.fr/marque/huawei/${key}/${slugify(model.name)}/`,
        count: model.products.length,
      };
    });

    newSections[key] = {
      title: line.name,
      description: null,
      cards: modelCards,
    };
  }

  console.log(`\n${isDryRun ? 'Gammes qui seraient ajoutées' : 'Gammes ajoutées'} : ${missingLines.length}\n`);

  if (!isDryRun && missingLines.length > 0) {
    fs.copyFileSync(CATEGORY_CONTENT_FILE, BACKUP_FILE);
    categoryContent[brandKey].cards.push(...newTopCards);
    Object.assign(categoryContent, newSections);
    fs.writeFileSync(CATEGORY_CONTENT_FILE, JSON.stringify(categoryContent, null, 2), 'utf-8');
    console.log(`Sauvegarde : ${BACKUP_FILE}`);
    console.log(`Fichier mis à jour : ${CATEGORY_CONTENT_FILE}`);
  } else if (isDryRun) {
    console.log('Pour appliquer réellement, relance sans --dry-run :');
    console.log('   node scripts/add-missing-huawei-gammes.js\n');
  }
}

main()
  .catch((e) => {
    console.error('Erreur :', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
