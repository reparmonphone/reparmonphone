/**
 * SCRIPT CORRECTIF — Les scripts précédents ne cherchaient que les URLs commençant
 * par "https://www.reparmonphone.fr/wp-content/uploads/". Or une partie des produits
 * (notamment Huawei/Xiaomi) ont leurs images enregistrées en "http://" (sans le "s"),
 * ce qui les a fait passer entre les mailles du filet — ni migrées, ni signalées en erreur.
 *
 * Ce script :
 *   1. Cherche TOUTES les URLs (http ET https) vers l'ancien domaine, dans la table
 *      Product (imageUrl + images[]) ET dans data/category_content.json.
 *   2. Télécharge via FTP + uploade vers Supabase celles qui manquent encore.
 *   3. Met à jour la base Prisma ET category_content.json avec les nouvelles URLs.
 *
 * MODE DRY-RUN (recommandé en premier) :
 *   node scripts/migrate-images/5-fix-http-and-remaining.js --dry-run
 *
 * MODE RÉEL :
 *   node scripts/migrate-images/5-fix-http-and-remaining.js
 */

const path = require('path');
const fs = require('fs');
const { Client: FtpClient } = require('basic-ftp');
const { createClient } = require('@supabase/supabase-js');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: path.join(__dirname, '../../.env.migration') });

const FTP_HOST = process.env.FTP_HOST;
const FTP_USER = process.env.FTP_USER;
const FTP_PASSWORD = process.env.FTP_PASSWORD;
const WP_UPLOADS_FTP_PATH = process.env.WP_UPLOADS_FTP_PATH || '/repar/wp-content/uploads';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || 'products';

// Accepte http:// ET https://, avec ou sans "www."
const OLD_URL_REGEX = /^https?:\/\/(www\.)?reparmonphone\.fr\/wp-content\/uploads\//i;

const MAP_FILE = path.join(__dirname, 'migration-map.json');
const CATEGORY_CONTENT_FILE = path.join(__dirname, '../../data/category_content.json');
const CATEGORY_BACKUP_FILE = path.join(__dirname, '../../data/category_content.backup2.json');
const TMP_DIR = path.join(__dirname, 'tmp-downloads');

const isDryRun = process.argv.includes('--dry-run');

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
        console.warn(`⚠️  Impossible d'écrire ${path.basename(filePath)} (${err.code || err.message}).`);
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

// Extrait le chemin relatif (après /wp-content/uploads/) d'une URL, peu importe http/https/www
function toRelativePath(url) {
  if (!url || typeof url !== 'string' || !OLD_URL_REGEX.test(url)) return null;
  return url.replace(OLD_URL_REGEX, '');
}

function mapUrl(oldUrl, migrationMap) {
  const relativePath = toRelativePath(oldUrl);
  if (!relativePath) return { newUrl: oldUrl, changed: false, missing: false };
  const newUrl = migrationMap[relativePath];
  if (!newUrl) return { newUrl: oldUrl, changed: false, missing: true, relativePath };
  return { newUrl, changed: newUrl !== oldUrl, missing: false, relativePath };
}

async function main() {
  if (!FTP_HOST || !FTP_USER || !FTP_PASSWORD || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Configuration incomplète, vérifie .env.migration');
    process.exit(1);
  }

  console.log(isDryRun ? '🧪 MODE DRY-RUN\n' : '⚠️  MODE RÉEL\n');

  const migrationMap = loadJson(MAP_FILE, {});
  console.log(`📄 ${Object.keys(migrationMap).length} correspondances déjà connues.\n`);

  // ---------- 1. Collecte de toutes les URLs (produits + category_content.json) ----------
  console.log('🔍 Lecture des produits en base...');
  const prisma = new PrismaClient();
  const products = await prisma.product.findMany({ select: { id: true, imageUrl: true, images: true } });

  const categoryContent = loadJson(CATEGORY_CONTENT_FILE, {});

  const allRelativePaths = new Set();
  for (const p of products) {
    const r1 = toRelativePath(p.imageUrl);
    if (r1) allRelativePaths.add(r1);
    for (const img of p.images || []) {
      const r2 = toRelativePath(img);
      if (r2) allRelativePaths.add(r2);
    }
  }
  for (const content of Object.values(categoryContent)) {
    for (const card of content.cards || []) {
      const r = toRelativePath(card.imageUrl);
      if (r) allRelativePaths.add(r);
    }
  }

  console.log(`📦 ${allRelativePaths.size} chemins uniques trouvés au total (produits + catégories, http+https confondus).`);

  const remaining = [...allRelativePaths].filter((p) => !migrationMap[p]);
  console.log(`✅ Déjà migrés : ${allRelativePaths.size - remaining.length}`);
  console.log(`⏳ Restant à migrer : ${remaining.length}\n`);

  // ---------- 2. Téléchargement + upload des fichiers manquants ----------
  if (remaining.length > 0) {
    if (isDryRun) {
      console.log('(dry-run : téléchargement des fichiers manquants ignoré — relance sans --dry-run pour les migrer)\n');
    } else {
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
      console.log(`\n✅ Réussis : ${successCount} | ❌ Échoués : ${failCount}\n`);
    }
  }

  // ---------- 3. Mise à jour de la base Prisma (produits) ----------
  console.log('📝 Application aux produits (base de données)...');
  let productsUpdated = 0;
  let productsMissing = 0;

  for (const product of products) {
    const { newUrl: newImageUrl, changed: c1, missing: m1 } = mapUrl(product.imageUrl, migrationMap);
    const newImages = (product.images || []).map((img) => mapUrl(img, migrationMap));
    const c2 = newImages.some((r, idx) => r.changed);
    const m2 = newImages.some((r) => r.missing);

    if (m1 || m2) productsMissing++;

    if (c1 || c2) {
      productsUpdated++;
      if (!isDryRun) {
        await prisma.product.update({
          where: { id: product.id },
          data: { imageUrl: newImageUrl, images: newImages.map((r) => r.newUrl) },
        });
      }
    }
  }
  await prisma.$disconnect();

  console.log(`${isDryRun ? 'À mettre à jour (simulation)' : 'Mis à jour'} : ${productsUpdated} produits`);
  if (productsMissing > 0) console.log(`⚠️  ${productsMissing} produits ont encore une image introuvable après migration.`);

  // ---------- 4. Mise à jour de category_content.json ----------
  console.log('\n📝 Application à category_content.json...');
  let cardsUpdated = 0;
  let cardsMissing = 0;

  for (const content of Object.values(categoryContent)) {
    for (const card of content.cards || []) {
      const { newUrl, changed, missing } = mapUrl(card.imageUrl, migrationMap);
      if (missing) cardsMissing++;
      if (changed) {
        cardsUpdated++;
        card.imageUrl = newUrl;
      }
    }
  }

  console.log(`${isDryRun ? 'À mettre à jour (simulation)' : 'Mis à jour'} : ${cardsUpdated} cartes`);
  if (cardsMissing > 0) console.log(`⚠️  ${cardsMissing} cartes ont encore une image introuvable.`);

  if (!isDryRun && cardsUpdated > 0) {
    fs.copyFileSync(CATEGORY_CONTENT_FILE, CATEGORY_BACKUP_FILE);
    saveJson(CATEGORY_CONTENT_FILE, categoryContent);
    console.log(`💾 Sauvegarde : ${CATEGORY_BACKUP_FILE}`);
    console.log(`✅ Fichier mis à jour : ${CATEGORY_CONTENT_FILE}`);
  }

  console.log('\n──────────────────────────────');
  if (isDryRun) {
    console.log('Pour appliquer réellement ces changements, relance sans --dry-run :');
    console.log('   node scripts/migrate-images/5-fix-http-and-remaining.js\n');
  } else {
    console.log('🎉 Terminé. Redéploie (git push) puis vérifie les fiches Huawei/Xiaomi en prod.\n');
  }
}

main().catch((err) => {
  console.error('\n💥 Erreur fatale :', err);
  process.exit(1);
});
