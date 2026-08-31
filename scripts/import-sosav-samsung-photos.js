/**
 * Remplace les photos de TOUS les modèles Samsung (toutes gammes confondues : Galaxy S, A, J, M,
 * Note, Z Fold/Flip, Tab, Watch, Xcover...) par des images cohérentes récupérées sur sosav.fr,
 * à la demande de l'utilisateur (droits confirmés côté utilisateur pour l'usage de ces images).
 *
 * Source des données : scripts/sosav-samsung-images.json — liste {name, imageUrl} extraite
 * directement des pages catégorie de sosav.fr (image réelle affichée pour CHAQUE modèle,
 * y compris les variantes "+", récupérée depuis la page catégorie propre à chaque modèle —
 * pas reconstruite depuis un slug de menu, qui peut être trompeur).
 *
 * Si jamais sosav.fr n'a pas de photo dédiée pour un modèle donné et réutilise l'image d'un
 * autre modèle, ce script le détecte et le signale en fin de rapport (voir "images partagées").
 *
 * Usage :
 *   node scripts/import-sosav-samsung-photos.js --dry-run   # rapport seul, aucune écriture
 *   node scripts/import-sosav-samsung-photos.js             # upload + mise à jour réelle
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env.migration') });
const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const { createClient } = require('@supabase/supabase-js');

const DRY_RUN = process.argv.includes('--dry-run');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.SUPABASE_BUCKET || 'products';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants dans .env.migration');
  process.exit(1);
}

const prisma = new PrismaClient();
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const DATA_PATH = path.join(__dirname, 'sosav-samsung-images.json');

const EXT_BY_CONTENT_TYPE = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

// ---------- Normalisation pour le matching nom DB <-> nom sosav ----------

function normalize(raw) {
  return raw
    .toUpperCase()
    .replace(/\s*\([^)]*\)\s*$/, '') // strip suffixe "(CODE)" en fin de nom (ex: "S23 (S911B)")
    .replace(/^GALAXY\s+/, '') // les noms sosav commencent tous par "Galaxy "
    .replace(/\bPLUS\b/g, '+') // "S22 Plus" -> "S22 +" (uniformise avec le symbole utilisé ailleurs)
    .replace(/\s*\+\s*/g, '+') // "S23 +" / "S22 +" -> "S23+" / "S22+"
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/([A-Z])\s+(\d)/g, '$1$2'); // "Z Fold 2" -> "Z FOLD2" (aligne l'espacement mot/chiffre)
}

// Retire un suffixe 4G/5G isolé, pour un rapprochement de secours quand le nom DB précise
// la génération réseau mais pas le nom sosav (ou l'inverse).
function stripNetworkGen(s) {
  return s.replace(/\s*\b(4G|5G)\b\s*$/, '').trim();
}

function buildSosavIndex(entries) {
  const byExact = new Map();
  const byLoose = new Map(); // sans 4G/5G, pour fallback
  for (const entry of entries) {
    const key = normalize(entry.name);
    if (!byExact.has(key)) byExact.set(key, entry);
    const looseKey = stripNetworkGen(key);
    if (!byLoose.has(looseKey)) byLoose.set(looseKey, entry);
  }
  return { byExact, byLoose };
}

function findSosavMatch(dbName, index) {
  const key = normalize(dbName);
  if (index.byExact.has(key)) return { entry: index.byExact.get(key), how: 'exact' };
  const looseKey = stripNetworkGen(key);
  if (index.byLoose.has(looseKey)) return { entry: index.byLoose.get(looseKey), how: '4g/5g-fuzzy' };
  return null;
}

async function downloadImage(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} en téléchargeant ${url}`);
  const contentType = res.headers.get('content-type') || 'image/jpeg';
  const buffer = Buffer.from(await res.arrayBuffer());
  const ext = EXT_BY_CONTENT_TYPE[contentType.split(';')[0].trim()] || (url.split('.').pop() || 'jpg').split('?')[0];
  return { buffer, contentType: contentType.split(';')[0].trim(), ext };
}

async function uploadToSupabase(buffer, contentType, ext) {
  const objectPath = `categories/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(objectPath, buffer, {
    contentType,
    upsert: false,
  });
  if (error) throw new Error(`Échec upload Supabase (${objectPath}) : ${error.message}`);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
  return data.publicUrl;
}

async function main() {
  if (!fs.existsSync(DATA_PATH)) {
    console.error(`❌ Fichier introuvable : ${DATA_PATH}`);
    console.error('   Place le fichier sosav-samsung-images.json à côté de ce script avant de le lancer.');
    process.exit(1);
  }
  const sosavEntries = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  console.log(`📦 ${sosavEntries.length} images sosav.fr chargées depuis ${path.basename(DATA_PATH)}`);

  const index = buildSosavIndex(sosavEntries);

  const brand = await prisma.brand.findFirst({ where: { slug: 'samsung' } });
  if (!brand) {
    console.error('❌ Marque "samsung" introuvable en base.');
    process.exit(1);
  }

  const models = await prisma.model.findMany({
    where: { productLine: { brandId: brand.id } },
    include: { productLine: { select: { name: true } } },
    orderBy: [{ productLine: { name: 'asc' } }, { name: 'asc' }],
  });
  console.log(`📱 ${models.length} modèles Samsung en base (toutes gammes confondues)\n`);

  const matched = [];
  const unmatched = [];
  const usedSosavKeys = new Set();

  for (const model of models) {
    const result = findSosavMatch(model.name, index);
    if (result) {
      matched.push({ model, sosavEntry: result.entry, how: result.how });
      usedSosavKeys.add(normalize(result.entry.name));
    } else {
      unmatched.push(model);
    }
  }

  console.log(`✅ ${matched.length} modèles avec une correspondance sosav.fr`);
  console.log(`⚠️  ${unmatched.length} modèles SANS correspondance (conservent leur image actuelle)\n`);

  if (unmatched.length) {
    console.log('--- Modèles sans correspondance ---');
    for (const m of unmatched) {
      console.log(`   • [${m.productLine.name}] ${m.name}`);
    }
    console.log('');
  }

  // Entrées sosav jamais utilisées (gammes que le site liste mais que ton catalogue n'a pas, ou noms trop différents)
  const allSosavKeys = new Set([...index.byExact.keys()]);
  const unusedSosavKeys = [...allSosavKeys].filter((k) => !usedSosavKeys.has(k));
  if (unusedSosavKeys.length) {
    console.log(`ℹ️  ${unusedSosavKeys.length} images sosav.fr non utilisées (aucun modèle correspondant en base) — normal si ton catalogue ne couvre pas toute la gamme Samsung.`);
    console.log('');
  }

  // Signale les cas où plusieurs modèles DB matchés recevraient la même image sosav.fr
  // (arrive parfois quand sosav.fr n'a pas de photo dédiée pour une variante).
  const byImageUrl = new Map();
  for (const { model, sosavEntry } of matched) {
    if (!byImageUrl.has(sosavEntry.imageUrl)) byImageUrl.set(sosavEntry.imageUrl, []);
    byImageUrl.get(sosavEntry.imageUrl).push(model.name);
  }
  const sharedImageGroups = [...byImageUrl.entries()].filter(([, names]) => names.length > 1);
  if (sharedImageGroups.length) {
    console.log(`⚠️  ${sharedImageGroups.length} image(s) sosav.fr partagée(s) par plusieurs modèles de ta base :`);
    for (const [url, names] of sharedImageGroups) {
      console.log(`   • ${names.join(' / ')} -> ${url}`);
    }
    console.log('');
  }

  if (DRY_RUN) {
    console.log('--- DRY-RUN : détail des correspondances (aucune écriture) ---');
    for (const { model, sosavEntry, how } of matched) {
      console.log(`   [${model.productLine.name}] "${model.name}" -> "${sosavEntry.name}" (${how})`);
      console.log(`       ${sosavEntry.imageUrl}`);
    }
    console.log(`\n🔎 Dry-run terminé : ${matched.length} modèles seraient mis à jour. Relance sans --dry-run pour appliquer.`);
    return;
  }

  console.log('🚀 Import réel : téléchargement + upload Supabase + mise à jour en base...\n');
  let done = 0;
  let failed = 0;
  for (const { model, sosavEntry } of matched) {
    try {
      const { buffer, contentType, ext } = await downloadImage(sosavEntry.imageUrl);
      const publicUrl = await uploadToSupabase(buffer, contentType, ext);
      await prisma.model.update({ where: { id: model.id }, data: { imageUrl: publicUrl } });
      done++;
      console.log(`   ✅ [${model.productLine.name}] ${model.name}`);
    } catch (err) {
      failed++;
      console.error(`   ❌ [${model.productLine.name}] ${model.name} : ${err.message}`);
    }
  }

  console.log(`\n🎉 Terminé : ${done} modèles mis à jour, ${failed} échecs, ${unmatched.length} sans correspondance.`);
  if (done > 0) {
    console.log('⚠️  Pense à faire un `git push` (ou redeploy) pour rafraîchir le cache des pages /marque/... côté public.');
  }
}

main()
  .catch((err) => {
    console.error('❌ Erreur fatale :', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
