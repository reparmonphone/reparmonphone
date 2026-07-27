/**
 * ÉTAPE 1/2 — Télécharge les images depuis le FTP OVH (ancien site WooCommerce)
 * et les uploade vers le bucket Supabase Storage "products".
 *
 * Ce script NE TOUCHE PAS à la base de données. Il se contente de migrer les
 * fichiers et d'écrire un fichier de correspondance (migration-map.json) que
 * le script 2 (2-update-database.js) utilisera ensuite pour mettre à jour Prisma.
 *
 * On peut relancer ce script plusieurs fois sans risque : il reprend là où il
 * s'était arrêté (les fichiers déjà migrés sont retrouvés dans migration-map.json
 * et ne sont pas re-téléchargés).
 *
 * INSTALLATION (à faire une seule fois, depuis la racine du projet Next.js) :
 *   npm install basic-ftp @supabase/supabase-js dotenv --save-dev
 *
 * CONFIGURATION :
 *   1. Copie .env.migration.example en .env.migration
 *   2. Remplis les valeurs (FTP + Supabase)
 *
 * LANCEMENT :
 *   node scripts/migrate-images/1-download-and-upload.js
 */

const path = require('path');
const fs = require('fs');
const { Client: FtpClient } = require('basic-ftp');
const { createClient } = require('@supabase/supabase-js');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: path.join(__dirname, '../../.env.migration') });

// ---------- Configuration ----------
const FTP_HOST = process.env.FTP_HOST;
const FTP_USER = process.env.FTP_USER;
const FTP_PASSWORD = process.env.FTP_PASSWORD;
// Chemin FTP vers le dossier wp-content/uploads sur le serveur OVH.
// Sur la plupart des hébergements mutualisés OVH, la racine web est le dossier "www".
// Si le script ne trouve pas les fichiers, essaie de changer cette valeur
// (par exemple juste "/wp-content/uploads" sans le "www/" devant).
const WP_UPLOADS_FTP_PATH = process.env.WP_UPLOADS_FTP_PATH || '/www/wp-content/uploads';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || 'products';

const OLD_DOMAIN_PREFIX = 'https://www.reparmonphone.fr/wp-content/uploads/';

const MAP_FILE = path.join(__dirname, 'migration-map.json');
const FAILED_FILE = path.join(__dirname, 'migration-failed.json');
const TMP_DIR = path.join(__dirname, 'tmp-downloads');

// ---------- Vérifications de config avant de démarrer ----------
function checkConfig() {
  const missing = [];
  if (!FTP_HOST) missing.push('FTP_HOST');
  if (!FTP_USER) missing.push('FTP_USER');
  if (!FTP_PASSWORD) missing.push('FTP_PASSWORD');
  if (!SUPABASE_URL) missing.push('NEXT_PUBLIC_SUPABASE_URL (ou SUPABASE_URL)');
  if (!SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');

  if (missing.length > 0) {
    console.error('\n❌ Variables manquantes dans .env.migration :');
    missing.forEach((m) => console.error(`   - ${m}`));
    console.error('\nCrée le fichier .env.migration à la racine du projet (voir .env.migration.example)\n');
    process.exit(1);
  }
}

// ---------- Utilitaires ----------
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
      // Écriture via fichier temporaire puis renommage : évite les conflits de verrouillage
      // Windows (antivirus, OneDrive, etc.) qui peuvent survenir sur une écriture directe.
      const tmpPath = `${filePath}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tmpPath, filePath);
      return;
    } catch (err) {
      if (attempt === retries) {
        // On n'interrompt jamais tout le script pour un simple souci d'écriture du fichier
        // de suivi — on avertit et on continue, la prochaine sauvegarde réussie rattrapera l'état.
        console.warn(`\n⚠️  Impossible d'écrire ${path.basename(filePath)} après ${retries} tentatives (${err.code || err.message}). On continue.`);
        return;
      }
    }
  }
}

// Extrait toutes les URLs images uniques (imageUrl + tableau images[]) depuis les produits
function extractUniqueImagePaths(products) {
  const paths = new Set();

  for (const product of products) {
    if (product.imageUrl && product.imageUrl.startsWith(OLD_DOMAIN_PREFIX)) {
      paths.add(product.imageUrl.slice(OLD_DOMAIN_PREFIX.length));
    }
    for (const img of product.images || []) {
      if (img && img.startsWith(OLD_DOMAIN_PREFIX)) {
        paths.add(img.slice(OLD_DOMAIN_PREFIX.length));
      }
    }
  }

  return [...paths];
}

function guessContentType(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const map = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    svg: 'image/svg+xml',
  };
  return map[ext] || 'application/octet-stream';
}

// ---------- Script principal ----------
async function main() {
  checkConfig();

  console.log('🔍 Lecture des produits en base (Prisma)...');
  const prisma = new PrismaClient();
  const products = await prisma.product.findMany({
    select: { id: true, imageUrl: true, images: true },
  });
  await prisma.$disconnect();

  const relativePaths = extractUniqueImagePaths(products);
  console.log(`📦 ${products.length} produits analysés — ${relativePaths.length} fichiers images uniques à migrer.\n`);

  if (relativePaths.length === 0) {
    console.log('Aucune image à migrer (toutes les URLs sont déjà à jour, ou aucun produit ne matche l\'ancien domaine).');
    return;
  }

  // Charge la progression existante (reprise possible)
  const migrationMap = loadJson(MAP_FILE, {}); // { "2025/02/xxx.webp": "https://.../storage/v1/object/public/products/2025/02/xxx.webp" }
  const failedList = loadJson(FAILED_FILE, []);

  const remaining = relativePaths.filter((p) => !migrationMap[p]);
  console.log(`✅ Déjà migrés (reprise) : ${relativePaths.length - remaining.length}`);
  console.log(`⏳ Restant à migrer : ${remaining.length}\n`);

  if (remaining.length === 0) {
    console.log('🎉 Tout est déjà migré ! Passe directement au script 2 (2-update-database.js).');
    return;
  }

  // Prépare le dossier temporaire local
  fs.mkdirSync(TMP_DIR, { recursive: true });

  // Connexion FTP
  const ftp = new FtpClient();
  ftp.ftp.verbose = false;
  console.log(`🔌 Connexion FTP à ${FTP_HOST}...`);
  await ftp.access({
    host: FTP_HOST,
    user: FTP_USER,
    password: FTP_PASSWORD,
    secure: 'implicit' === 'implicit' ? false : true, // FTP explicite TLS géré automatiquement par basic-ftp si dispo
  });
  console.log('✅ Connecté au FTP.\n');

  // Connexion Supabase (clé service_role = accès complet, à utiliser uniquement en local/serveur, jamais côté client)
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < remaining.length; i++) {
    const relativePath = remaining[i]; // ex: "2025/02/ecran-iphone-16-pro-max-origine-demonter_jpg.webp"
    const filename = path.basename(relativePath);
    const localTmpPath = path.join(TMP_DIR, filename);
    const ftpSourcePath = path.posix.join(WP_UPLOADS_FTP_PATH, relativePath);

    process.stdout.write(`[${i + 1}/${remaining.length}] ${relativePath} ... `);

    try {
      // 1. Télécharge depuis le FTP
      await ftp.downloadTo(localTmpPath, ftpSourcePath);

      // 2. Lit le fichier téléchargé
      const fileBuffer = fs.readFileSync(localTmpPath);

      // 3. Uploade vers Supabase Storage (même arborescence que l'original, pour éviter les collisions de noms)
      const { error: uploadError } = await supabase.storage
        .from(SUPABASE_BUCKET)
        .upload(relativePath, fileBuffer, {
          contentType: guessContentType(filename),
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // 4. Récupère l'URL publique
      const { data: publicUrlData } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(relativePath);
      const publicUrl = publicUrlData.publicUrl;

      // 5. Enregistre la correspondance et nettoie le fichier temporaire
      migrationMap[relativePath] = publicUrl;
      fs.unlinkSync(localTmpPath);
      saveJson(MAP_FILE, migrationMap); // sauvegarde à chaque fichier pour permettre la reprise en cas d'interruption

      successCount++;
      console.log('✅');
    } catch (err) {
      failCount++;
      console.log(`❌ (${err.message || err})`);
      if (!failedList.includes(relativePath)) {
        failedList.push(relativePath);
        saveJson(FAILED_FILE, failedList);
      }
      // Nettoie le fichier temporaire partiel s'il existe
      if (fs.existsSync(localTmpPath)) fs.unlinkSync(localTmpPath);
    }
  }

  ftp.close();

  console.log('\n──────────────────────────────');
  console.log(`✅ Réussis : ${successCount}`);
  console.log(`❌ Échoués : ${failCount}`);
  if (failCount > 0) {
    console.log(`\n⚠️  Les fichiers en échec sont listés dans : ${FAILED_FILE}`);
    console.log('   Cause la plus fréquente : le chemin WP_UPLOADS_FTP_PATH est incorrect,');
    console.log('   ou le fichier n\'existe plus sur le serveur OVH (produit obsolète/supprimé).');
    console.log('   Tu peux relancer ce script après correction : il ne retentera que les manquants.');
  }
  console.log('──────────────────────────────\n');
  console.log(`📄 Correspondances enregistrées dans : ${MAP_FILE}`);
  console.log('➡️  Étape suivante : node scripts/migrate-images/2-update-database.js --dry-run\n');
}

main().catch((err) => {
  console.error('\n💥 Erreur fatale :', err);
  process.exit(1);
});
