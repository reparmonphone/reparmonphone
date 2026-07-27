/**
 * ÉTAPE COMPLÉMENTAIRE — Migre les images qui sont référencées UNIQUEMENT dans
 * data/category_content.json (illustrations de marques/gammes) et qui n'ont pas
 * été trouvées par le script 1 (qui ne regarde que la table Product).
 *
 * Ce script complète migration-map.json avec ces images en plus — après
 * l'avoir lancé, relance le script 3 (3-fix-category-content-json.js) pour
 * appliquer les nouvelles correspondances dans category_content.json.
 *
 * LANCEMENT :
 *   node scripts/migrate-images/4-migrate-category-images.js
 */

const path = require('path');
const fs = require('fs');
const { Client: FtpClient } = require('basic-ftp');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.join(__dirname, '../../.env.migration') });

const FTP_HOST = process.env.FTP_HOST;
const FTP_USER = process.env.FTP_USER;
const FTP_PASSWORD = process.env.FTP_PASSWORD;
const WP_UPLOADS_FTP_PATH = process.env.WP_UPLOADS_FTP_PATH || '/repar/wp-content/uploads';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || 'products';

const OLD_DOMAIN_PREFIX = 'https://www.reparmonphone.fr/wp-content/uploads/';

const MAP_FILE = path.join(__dirname, 'migration-map.json');
const CATEGORY_CONTENT_FILE = path.join(__dirname, '../../data/category_content.json');
const TMP_DIR = path.join(__dirname, 'tmp-downloads');

function loadJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return fallback;
  }
}

function saveJson(filePath, data, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const tmpPath = `${filePath}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tmpPath, filePath);
      return;
    } catch (err) {
      if (attempt === retries) {
        console.warn(`⚠️  Impossible d'écrire ${path.basename(filePath)} (${err.code || err.message}). On continue.`);
        return;
      }
    }
  }
}

function guessContentType(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const map = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml' };
  return map[ext] || 'application/octet-stream';
}

async function main() {
  const missing = [];
  if (!FTP_HOST || !FTP_USER || !FTP_PASSWORD || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) missing.push('des variables .env.migration');
  if (missing.length) {
    console.error('❌ Configuration incomplète, vérifie .env.migration');
    process.exit(1);
  }

  const categoryContent = loadJson(CATEGORY_CONTENT_FILE, null);
  if (!categoryContent) {
    console.error(`❌ Fichier introuvable : ${CATEGORY_CONTENT_FILE}`);
    process.exit(1);
  }

  const migrationMap = loadJson(MAP_FILE, {});

  // Extrait toutes les URLs uniques du fichier de contenu catégories
  const relativePaths = new Set();
  for (const content of Object.values(categoryContent)) {
    for (const card of content.cards || []) {
      if (card.imageUrl && card.imageUrl.startsWith(OLD_DOMAIN_PREFIX)) {
        relativePaths.add(card.imageUrl.slice(OLD_DOMAIN_PREFIX.length));
      }
    }
  }

  const remaining = [...relativePaths].filter((p) => !migrationMap[p]);
  console.log(`📦 ${relativePaths.size} images uniques référencées dans category_content.json`);
  console.log(`✅ Déjà migrées : ${relativePaths.size - remaining.length}`);
  console.log(`⏳ À migrer maintenant : ${remaining.length}\n`);

  if (remaining.length === 0) {
    console.log('🎉 Rien à faire — relance directement le script 3.');
    return;
  }

  fs.mkdirSync(TMP_DIR, { recursive: true });

  const ftp = new FtpClient();
  ftp.ftp.verbose = false;
  console.log(`🔌 Connexion FTP à ${FTP_HOST}...`);
  await ftp.access({ host: FTP_HOST, user: FTP_USER, password: FTP_PASSWORD });
  console.log('✅ Connecté.\n');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < remaining.length; i++) {
    const relativePath = remaining[i];
    const filename = path.basename(relativePath);
    const localTmpPath = path.join(TMP_DIR, filename);
    const ftpSourcePath = path.posix.join(WP_UPLOADS_FTP_PATH, relativePath);

    process.stdout.write(`[${i + 1}/${remaining.length}] ${relativePath} ... `);

    try {
      await ftp.downloadTo(localTmpPath, ftpSourcePath);
      const fileBuffer = fs.readFileSync(localTmpPath);

      const { error: uploadError } = await supabase.storage
        .from(SUPABASE_BUCKET)
        .upload(relativePath, fileBuffer, { contentType: guessContentType(filename), upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(relativePath);
      migrationMap[relativePath] = publicUrlData.publicUrl;

      fs.unlinkSync(localTmpPath);
      saveJson(MAP_FILE, migrationMap);

      successCount++;
      console.log('✅');
    } catch (err) {
      failCount++;
      console.log(`❌ (${err.message || err})`);
      if (fs.existsSync(localTmpPath)) fs.unlinkSync(localTmpPath);
    }
  }

  ftp.close();

  console.log('\n──────────────────────────────');
  console.log(`✅ Réussis : ${successCount}`);
  console.log(`❌ Échoués : ${failCount}`);
  console.log('──────────────────────────────\n');
  console.log('➡️  Étape suivante : node scripts/migrate-images/3-fix-category-content-json.js --dry-run\n');
}

main().catch((err) => {
  console.error('\n💥 Erreur fatale :', err);
  process.exit(1);
});
