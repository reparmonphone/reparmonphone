/**
 * Migre UN SEUL fichier depuis le FTP OVH vers Supabase Storage, et affiche
 * la nouvelle URL à utiliser. Utile pour les fichiers codés en dur dans des
 * composants React (ex: logo du header) qui ne sont référencés ni dans la
 * table Product ni dans category_content.json, et donc jamais couverts par
 * les scripts 1/3/4/5.
 *
 * USAGE :
 *   node scripts/migrate-images/6-migrate-single-file.js 2025/03/logo-repar-mon-phone-3.png
 *
 * (le chemin donné est relatif à wp-content/uploads/, comme dans les autres scripts)
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

const MAP_FILE = path.join(__dirname, 'migration-map.json');
const TMP_DIR = path.join(__dirname, 'tmp-downloads');

function guessContentType(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const map = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml' };
  return map[ext] || 'application/octet-stream';
}

async function main() {
  const relativePath = process.argv[2];
  if (!relativePath) {
    console.error('❌ Usage : node scripts/migrate-images/6-migrate-single-file.js <chemin/relatif/fichier.jpg>');
    process.exit(1);
  }

  if (!FTP_HOST || !FTP_USER || !FTP_PASSWORD || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Configuration incomplète, vérifie .env.migration');
    process.exit(1);
  }

  fs.mkdirSync(TMP_DIR, { recursive: true });
  const filename = path.basename(relativePath);
  const localTmpPath = path.join(TMP_DIR, filename);
  const ftpSourcePath = path.posix.join(WP_UPLOADS_FTP_PATH, relativePath);

  console.log(`🔌 Connexion FTP à ${FTP_HOST}...`);
  const ftp = new FtpClient();
  ftp.ftp.verbose = false;
  await ftp.access({ host: FTP_HOST, user: FTP_USER, password: FTP_PASSWORD });

  console.log(`⬇️  Téléchargement de ${ftpSourcePath}...`);
  await ftp.downloadTo(localTmpPath, ftpSourcePath);
  ftp.close();

  const fileBuffer = fs.readFileSync(localTmpPath);
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  console.log('⬆️  Upload vers Supabase...');
  const { error: uploadError } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .upload(relativePath, fileBuffer, { contentType: guessContentType(filename), upsert: true });

  if (uploadError) {
    console.error('❌ Erreur upload :', uploadError.message);
    process.exit(1);
  }

  const { data: publicUrlData } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(relativePath);
  fs.unlinkSync(localTmpPath);

  // Complète aussi migration-map.json pour cohérence avec les autres scripts
  const migrationMap = fs.existsSync(MAP_FILE) ? JSON.parse(fs.readFileSync(MAP_FILE, 'utf-8')) : {};
  migrationMap[relativePath] = publicUrlData.publicUrl;
  fs.writeFileSync(MAP_FILE, JSON.stringify(migrationMap, null, 2), 'utf-8');

  console.log('\n✅ Terminé !');
  console.log(`\n🔗 Nouvelle URL à utiliser :\n${publicUrlData.publicUrl}\n`);
}

main().catch((err) => {
  console.error('\n💥 Erreur :', err.message || err);
  process.exit(1);
});
