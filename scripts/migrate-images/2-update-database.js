/**
 * ÉTAPE 2/2 — Met à jour la base de données (table "products") pour remplacer
 * les anciennes URLs (https://www.reparmonphone.fr/wp-content/uploads/...)
 * par les nouvelles URLs Supabase Storage, en utilisant le fichier de
 * correspondance généré par le script 1 (migration-map.json).
 *
 * MODE DRY-RUN (recommandé en premier) — n'écrit rien en base, affiche juste
 * ce qui serait modifié :
 *   node scripts/migrate-images/2-update-database.js --dry-run
 *
 * MODE RÉEL — applique les changements en base :
 *   node scripts/migrate-images/2-update-database.js
 */

const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: path.join(__dirname, '../../.env.migration') });

const MAP_FILE = path.join(__dirname, 'migration-map.json');
const OLD_DOMAIN_PREFIX = 'https://www.reparmonphone.fr/wp-content/uploads/';

const isDryRun = process.argv.includes('--dry-run');

function loadJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return fallback;
  }
}

function mapUrl(oldUrl, migrationMap) {
  if (!oldUrl || !oldUrl.startsWith(OLD_DOMAIN_PREFIX)) return oldUrl; // inchangé si ce n'est pas une ancienne URL
  const relativePath = oldUrl.slice(OLD_DOMAIN_PREFIX.length);
  const newUrl = migrationMap[relativePath];
  return newUrl || oldUrl; // si pas encore migré, on laisse l'ancienne URL (sera corrigée au prochain passage)
}

async function main() {
  if (!fs.existsSync(MAP_FILE)) {
    console.error(`❌ Fichier introuvable : ${MAP_FILE}`);
    console.error('   Lance d\'abord : node scripts/migrate-images/1-download-and-upload.js');
    process.exit(1);
  }

  const migrationMap = loadJson(MAP_FILE, {});
  const migratedCount = Object.keys(migrationMap).length;
  console.log(`📄 ${migratedCount} correspondances chargées depuis migration-map.json\n`);

  if (isDryRun) {
    console.log('🧪 MODE DRY-RUN — aucune écriture en base ne sera faite.\n');
  } else {
    console.log('⚠️  MODE RÉEL — les produits vont être mis à jour en base.\n');
  }

  const prisma = new PrismaClient();
  const products = await prisma.product.findMany({
    select: { id: true, title: true, imageUrl: true, images: true },
  });

  let toUpdateCount = 0;
  let unchangedCount = 0;
  let stillMissingCount = 0;
  const stillMissingSamples = [];

  for (const product of products) {
    const newImageUrl = mapUrl(product.imageUrl, migrationMap);
    const newImages = (product.images || []).map((img) => mapUrl(img, migrationMap));

    const imageUrlChanged = newImageUrl !== product.imageUrl;
    const imagesChanged = JSON.stringify(newImages) !== JSON.stringify(product.images);

    // Détecte les URLs qui pointent encore vers l'ancien domaine après mapping (fichier pas encore migré)
    const stillOld =
      (newImageUrl && newImageUrl.startsWith(OLD_DOMAIN_PREFIX)) ||
      newImages.some((img) => img && img.startsWith(OLD_DOMAIN_PREFIX));

    if (stillOld) {
      stillMissingCount++;
      if (stillMissingSamples.length < 10) {
        stillMissingSamples.push({ id: product.id, title: product.title, imageUrl: newImageUrl });
      }
    }

    if (imageUrlChanged || imagesChanged) {
      toUpdateCount++;
      if (isDryRun) {
        if (toUpdateCount <= 10) {
          console.log(`Produit "${product.title}" (${product.id})`);
          if (imageUrlChanged) console.log(`   imageUrl: ${product.imageUrl}\n           → ${newImageUrl}`);
          if (imagesChanged) console.log(`   images: ${JSON.stringify(product.images)}\n         → ${JSON.stringify(newImages)}`);
          console.log('');
        }
      } else {
        await prisma.product.update({
          where: { id: product.id },
          data: { imageUrl: newImageUrl, images: newImages },
        });
      }
    } else {
      unchangedCount++;
    }
  }

  await prisma.$disconnect();

  console.log('──────────────────────────────');
  console.log(`Produits analysés : ${products.length}`);
  console.log(`${isDryRun ? 'À mettre à jour (simulation)' : 'Mis à jour'} : ${toUpdateCount}`);
  console.log(`Inchangés (déjà OK) : ${unchangedCount}`);
  if (stillMissingCount > 0) {
    console.log(`\n⚠️  ${stillMissingCount} produits ont encore au moins une URL non migrée`);
    console.log('   (le fichier correspondant n\'a pas encore été uploadé avec succès sur Supabase).');
    console.log('   Exemples :');
    stillMissingSamples.forEach((p) => console.log(`   - ${p.title} (${p.id}) → ${p.imageUrl}`));
    console.log('\n   Vérifie migration-failed.json et relance le script 1 pour ces fichiers manquants.');
  }
  console.log('──────────────────────────────\n');

  if (isDryRun && toUpdateCount > 0) {
    console.log('Pour appliquer réellement ces changements, relance sans --dry-run :');
    console.log('   node scripts/migrate-images/2-update-database.js\n');
  }
}

main().catch((err) => {
  console.error('\n💥 Erreur fatale :', err);
  process.exit(1);
});
