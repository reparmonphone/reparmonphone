/**
 * Ajoute dans data/category_content.json les cartes manquantes pour les modèles créés
 * automatiquement (ex: via un import fournisseur) mais absents du fichier statique de contenu
 * des catégories — ce fichier ne se met jamais à jour tout seul quand un nouveau modèle est créé
 * en base, il faut donc le synchroniser manuellement après ce genre d'opération.
 *
 * Réutilise la photo d'un produit déjà existant sous chaque nouveau modèle comme illustration
 * de la carte (pas de nouvelle image à aller chercher).
 *
 * MODE DRY-RUN (recommandé en premier) :
 *   node scripts/sync-outils-cards.js --dry-run
 *
 * MODE RÉEL :
 *   node scripts/sync-outils-cards.js
 */

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const isDryRun = process.argv.includes('--dry-run');
const CATEGORY_CONTENT_FILE = path.join(__dirname, '../data/category_content.json');
const BACKUP_FILE = path.join(__dirname, '../data/category_content.backup-outils.json');

// Clés possibles pour la section "Outils" dans le fichier — on essaie plusieurs variantes
// courantes et on indique clairement laquelle a été trouvée.
const CANDIDATE_KEYS = ['outils', 'Outils'];

async function main() {
  if (!fs.existsSync(CATEGORY_CONTENT_FILE)) {
    console.error(`❌ Fichier introuvable : ${CATEGORY_CONTENT_FILE}`);
    process.exit(1);
  }
  const categoryContent = JSON.parse(fs.readFileSync(CATEGORY_CONTENT_FILE, 'utf-8'));

  let matchedKey = null;
  for (const key of CANDIDATE_KEYS) {
    if (categoryContent[key]) {
      matchedKey = key;
      break;
    }
  }
  if (!matchedKey) {
    console.error(`❌ Aucune section trouvée pour "Outils" parmi les clés testées : ${CANDIDATE_KEYS.join(', ')}`);
    console.error('   Clés réellement présentes dans le fichier :', Object.keys(categoryContent).slice(0, 30).join(', '), '...');
    console.error('   Corrige CANDIDATE_KEYS dans ce script avec la bonne clé, puis relance.');
    process.exit(1);
  }
  console.log(`📄 Section trouvée sous la clé "${matchedKey}", ${categoryContent[matchedKey].cards.length} carte(s) déjà présente(s).\n`);

  const existingCardNames = new Set(categoryContent[matchedKey].cards.map((c) => c.name.trim().toLowerCase()));

  const brand = await prisma.brand.findUnique({ where: { slug: 'outils' } });
  if (!brand) {
    console.error('❌ Marque "Outils" introuvable en base.');
    process.exit(1);
  }

  const models = await prisma.model.findMany({
    where: { productLine: { brandId: brand.id } },
    include: { products: { where: { showInBoutique: true }, select: { id: true, imageUrl: true } } },
  });

  const missing = models.filter((m) => !existingCardNames.has(m.name.trim().toLowerCase()));

  console.log(`🔍 ${models.length} modèle(s) en base sous "Outils", dont ${missing.length} absent(s) du fichier de contenu :\n`);

  const newCards = [];
  for (const model of missing) {
    const count = model.products.length;
    const representativeImage = model.products.find((p) => p.imageUrl)?.imageUrl || null;
    console.log(`   - ${model.name} (${count} produit${count > 1 ? 's' : ''})${representativeImage ? '' : ' — ⚠️ aucune image trouvée, carte sans photo'}`);

    newCards.push({
      name: model.name,
      imageUrl: representativeImage,
      href: `https://www.reparmonphone.fr/outils/${model.slug}/`,
      count,
    });
  }

  console.log(`\n${isDryRun ? 'Cartes qui seraient ajoutées' : 'Cartes ajoutées'} : ${newCards.length}\n`);

  if (!isDryRun && newCards.length > 0) {
    fs.copyFileSync(CATEGORY_CONTENT_FILE, BACKUP_FILE);
    categoryContent[matchedKey].cards.push(...newCards);
    fs.writeFileSync(CATEGORY_CONTENT_FILE, JSON.stringify(categoryContent, null, 2), 'utf-8');
    console.log(`💾 Sauvegarde de l'ancien fichier : ${BACKUP_FILE}`);
    console.log(`✅ Fichier mis à jour : ${CATEGORY_CONTENT_FILE}`);
  } else if (isDryRun) {
    console.log('Pour appliquer réellement, relance sans --dry-run :');
    console.log('   node scripts/sync-outils-cards.js\n');
  }
}

main()
  .catch((e) => {
    console.error('💥 Erreur :', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
