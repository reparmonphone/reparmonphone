/**
 * Corrige les URLs d'images dans data/category_content.json en remplaçant
 * les anciennes URLs (https://www.reparmonphone.fr/wp-content/uploads/...)
 * par les nouvelles URLs Supabase Storage, en réutilisant la correspondance
 * déjà générée par le script scripts/migrate-images/1-download-and-upload.js
 * (fichier migration-map.json).
 *
 * Ce fichier JSON n'est PAS en base de données (c'est un fichier statique
 * du dépôt, utilisé par src/lib/categoryContent.ts) — d'où un script séparé.
 *
 * MODE DRY-RUN (recommandé en premier) — affiche ce qui serait changé sans
 * modifier le fichier :
 *   node scripts/migrate-images/3-fix-category-content-json.js --dry-run
 *
 * MODE RÉEL — applique les changements (une sauvegarde .backup.json est
 * créée automatiquement avant toute modification) :
 *   node scripts/migrate-images/3-fix-category-content-json.js
 */

const path = require('path');
const fs = require('fs');

const MAP_FILE = path.join(__dirname, 'migration-map.json');
const CATEGORY_CONTENT_FILE = path.join(__dirname, '../../data/category_content.json');
const BACKUP_FILE = path.join(__dirname, '../../data/category_content.backup.json');
const OLD_DOMAIN_PREFIX = 'https://www.reparmonphone.fr/wp-content/uploads/';

const isDryRun = process.argv.includes('--dry-run');

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function mapUrl(oldUrl, migrationMap) {
  if (!oldUrl || typeof oldUrl !== 'string' || !oldUrl.startsWith(OLD_DOMAIN_PREFIX)) {
    return { newUrl: oldUrl, changed: false, missing: false };
  }
  const relativePath = oldUrl.slice(OLD_DOMAIN_PREFIX.length);
  const newUrl = migrationMap[relativePath];
  if (!newUrl) {
    return { newUrl: oldUrl, changed: false, missing: true };
  }
  return { newUrl, changed: newUrl !== oldUrl, missing: false };
}

function main() {
  if (!fs.existsSync(MAP_FILE)) {
    console.error(`❌ Fichier introuvable : ${MAP_FILE}`);
    console.error('   Lance d\'abord le script 1 (1-download-and-upload.js) si ce n\'est pas déjà fait.');
    process.exit(1);
  }
  if (!fs.existsSync(CATEGORY_CONTENT_FILE)) {
    console.error(`❌ Fichier introuvable : ${CATEGORY_CONTENT_FILE}`);
    console.error('   Vérifie le chemin réel de data/category_content.json dans ton projet');
    console.error('   et ajuste la constante CATEGORY_CONTENT_FILE en haut de ce script si besoin.');
    process.exit(1);
  }

  const migrationMap = loadJson(MAP_FILE);
  const categoryContent = loadJson(CATEGORY_CONTENT_FILE);

  console.log(`📄 ${Object.keys(migrationMap).length} correspondances chargées.`);
  console.log(isDryRun ? '🧪 MODE DRY-RUN — aucune écriture ne sera faite.\n' : '⚠️  MODE RÉEL — le fichier sera modifié (backup créé avant).\n');

  let changedCount = 0;
  let missingCount = 0;
  const missingSamples = [];

  for (const [categoryKey, content] of Object.entries(categoryContent)) {
    if (!content.cards || !Array.isArray(content.cards)) continue;

    for (const card of content.cards) {
      const { newUrl, changed, missing } = mapUrl(card.imageUrl, migrationMap);

      if (missing) {
        missingCount++;
        if (missingSamples.length < 15) {
          missingSamples.push({ categoryKey, name: card.name, imageUrl: card.imageUrl });
        }
      }

      if (changed) {
        changedCount++;
        if (isDryRun && changedCount <= 15) {
          console.log(`[${categoryKey}] ${card.name}`);
          console.log(`   ${card.imageUrl}`);
          console.log(`   → ${newUrl}\n`);
        }
        card.imageUrl = newUrl;
      }
    }
  }

  console.log('──────────────────────────────');
  console.log(`Cartes ${isDryRun ? 'à modifier (simulation)' : 'modifiées'} : ${changedCount}`);
  if (missingCount > 0) {
    console.log(`\n⚠️  ${missingCount} images n'ont pas été trouvées dans migration-map.json`);
    console.log('   (probablement des fichiers présents dans ce JSON mais plus en base de données Prisma,');
    console.log('   ou pas encore migrés). Exemples :');
    missingSamples.forEach((s) => console.log(`   - [${s.categoryKey}] ${s.name} → ${s.imageUrl}`));
  }
  console.log('──────────────────────────────\n');

  if (!isDryRun && changedCount > 0) {
    fs.copyFileSync(CATEGORY_CONTENT_FILE, BACKUP_FILE);
    console.log(`💾 Sauvegarde de l'ancien fichier : ${BACKUP_FILE}`);
    fs.writeFileSync(CATEGORY_CONTENT_FILE, JSON.stringify(categoryContent, null, 2), 'utf-8');
    console.log(`✅ Fichier mis à jour : ${CATEGORY_CONTENT_FILE}`);
  } else if (isDryRun && changedCount > 0) {
    console.log('Pour appliquer réellement ces changements, relance sans --dry-run :');
    console.log('   node scripts/migrate-images/3-fix-category-content-json.js\n');
  }
}

main();
