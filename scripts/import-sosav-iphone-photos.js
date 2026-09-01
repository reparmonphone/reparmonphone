/**
 * Remplace les photos de TOUS les modèles iPhone (gamme "iPhone" de la marque Apple) par des
 * images cohérentes récupérées sur sosav.fr, à la demande de l'utilisateur (grossiste pièces
 * détachées de l'utilisateur, droits d'usage confirmés côté utilisateur).
 *
 * Même logique que scripts/import-sosav-samsung-photos.js (déjà exécuté avec succès pour les
 * modèles Samsung) : source des données = scripts/sosav-iphone-images.json (liste {name,
 * imageUrl}, une image "catégorie" par modèle, construite à partir de l'URL propre à chaque
 * modèle sur sosav.fr — pas une image générique reconstruite depuis un slug de menu).
 *
 * Ne touche QUE les modèles de la gamme "iPhone" (Apple > iPhone) — pas iPad/Watch/MacBook,
 * même s'ils appartiennent aussi à la marque "apple" en base.
 *
 * Usage :
 *   node scripts/import-sosav-iphone-photos.js --dry-run   # rapport seul, aucune écriture
 *   node scripts/import-sosav-iphone-photos.js             # upload + mise à jour réelle
 *   node scripts/import-sosav-iphone-photos.js --model="15 Pro Max"   # ne traite que les modèles
 *     dont le nom contient ce texte (utile pour retraiter un seul modèle après une erreur réseau
 *     en cours de route, sans re-télécharger/re-uploader tous les autres pour rien).
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env.migration') });
const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const { createClient } = require('@supabase/supabase-js');

const DRY_RUN = process.argv.includes('--dry-run');
const ONLY_FILTER = (() => {
  const arg = process.argv.find((a) => a.startsWith('--model='));
  if (!arg) return null;
  return arg.slice('--model='.length).replace(/^["']|["']$/g, '').toLowerCase();
})();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.SUPABASE_BUCKET || 'products';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants dans .env.migration');
  process.exit(1);
}

const prisma = new PrismaClient();
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const DATA_PATH = path.join(__dirname, 'sosav-iphone-images.json');

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
    .replace(/^IPHONE\s+/, '') // les deux côtés commencent par "iPhone " -> neutre pour le matching
    .replace(/\s+/g, ' ')
    .trim();
}

// "iPhone SE (3rd Generation - 2022)" -> "SE (2022)" / "iPhone SE (2nd Generation - 2020)" ->
// "SE (2020)" — pour rapprocher du format probable en base ("iPhone SE (2020)"), sans dépendre
// de l'ordinal exact utilisé par sosav.
function simplifyGeneration(s) {
  return s.replace(/\(\s*\d(?:st|nd|rd|th)?\s+Generation\s*-\s*(\d{4})\s*\)/i, '($1)');
}

// Retire tout suffixe entre parenthèses, pour un rapprochement de secours (ex: si la base a
// "iPhone SE" tout court pour un modèle où sosav précise une année).
function stripParenthetical(s) {
  return s.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

function buildSosavIndex(entries) {
  const byExact = new Map();
  const byLoose = new Map(); // sans parenthèse, pour fallback
  for (const entry of entries) {
    const key = normalize(simplifyGeneration(entry.name));
    if (!byExact.has(key)) byExact.set(key, entry);
    const looseKey = stripParenthetical(key);
    if (!byLoose.has(looseKey)) byLoose.set(looseKey, entry);
  }
  return { byExact, byLoose };
}

function findSosavMatch(dbName, index) {
  const key = normalize(dbName);
  if (index.byExact.has(key)) return { entry: index.byExact.get(key), how: 'exact' };
  const looseKey = stripParenthetical(key);
  if (index.byLoose.has(looseKey)) return { entry: index.byLoose.get(looseKey), how: 'sans-parenthese-fuzzy' };
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
    console.error('   Place le fichier sosav-iphone-images.json à côté de ce script avant de le lancer.');
    process.exit(1);
  }
  const sosavEntries = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  console.log(`📦 ${sosavEntries.length} images sosav.fr chargées depuis ${path.basename(DATA_PATH)}`);

  const index = buildSosavIndex(sosavEntries);

  const brand = await prisma.brand.findFirst({ where: { slug: 'apple' } });
  if (!brand) {
    console.error('❌ Marque "apple" introuvable en base.');
    process.exit(1);
  }

  const line = await prisma.productLine.findFirst({
    where: { brandId: brand.id, name: 'iPhone' },
  });
  if (!line) {
    console.error('❌ Gamme "iPhone" introuvable en base sous la marque Apple.');
    process.exit(1);
  }

  let models = await prisma.model.findMany({
    where: { productLineId: line.id },
    orderBy: { name: 'asc' },
  });
  if (ONLY_FILTER) {
    models = models.filter((m) => m.name.toLowerCase().includes(ONLY_FILTER));
    console.log(`🔎 Filtré avec --model="${ONLY_FILTER}" : ${models.length} modèle(s) retenu(s)`);
  }
  console.log(`📱 ${models.length} modèles iPhone en base\n`);

  const matched = [];
  const unmatched = [];
  const usedSosavKeys = new Set();

  for (const model of models) {
    const result = findSosavMatch(model.name, index);
    if (result) {
      matched.push({ model, sosavEntry: result.entry, how: result.how });
      usedSosavKeys.add(normalize(simplifyGeneration(result.entry.name)));
    } else {
      unmatched.push(model);
    }
  }

  console.log(`✅ ${matched.length} modèles avec une correspondance sosav.fr`);
  console.log(`⚠️  ${unmatched.length} modèles SANS correspondance (conservent leur image actuelle)\n`);

  if (unmatched.length) {
    console.log('--- Modèles sans correspondance ---');
    for (const m of unmatched) {
      console.log(`   • ${m.name}`);
    }
    console.log('');
  }

  const allSosavKeys = new Set([...index.byExact.keys()]);
  const unusedSosavKeys = [...allSosavKeys].filter((k) => !usedSosavKeys.has(k));
  if (unusedSosavKeys.length && !ONLY_FILTER) {
    console.log(`ℹ️  ${unusedSosavKeys.length} images sosav.fr non utilisées (aucun modèle correspondant en base) — normal si ton catalogue ne couvre pas toute la gamme iPhone.`);
    console.log('');
  }

  // Signale les cas où plusieurs modèles DB matchés recevraient la même image sosav.fr (arrive
  // surtout via le fallback "sans parenthèse", ex: SE 2016/2020/2022 si la base ne précise pas
  // toujours l'année).
  const byImageUrl = new Map();
  for (const { model, sosavEntry } of matched) {
    if (!byImageUrl.has(sosavEntry.imageUrl)) byImageUrl.set(sosavEntry.imageUrl, []);
    byImageUrl.get(sosavEntry.imageUrl).push(model.name);
  }
  const sharedImageGroups = [...byImageUrl.entries()].filter(([, names]) => names.length > 1);
  if (sharedImageGroups.length) {
    console.log(`⚠️  ${sharedImageGroups.length} image(s) sosav.fr partagée(s) par plusieurs modèles de ta base — vérifie que ce n'est pas une erreur de correspondance (ex: plusieurs générations d'iPhone SE) :`);
    for (const [url, names] of sharedImageGroups) {
      console.log(`   • ${names.join(' / ')} -> ${url}`);
    }
    console.log('');
  }

  if (DRY_RUN) {
    console.log('--- DRY-RUN : détail des correspondances (aucune écriture) ---');
    for (const { model, sosavEntry, how } of matched) {
      console.log(`   "${model.name}" -> "${sosavEntry.name}" (${how})`);
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
      console.log(`   ✅ ${model.name}`);
    } catch (err) {
      failed++;
      console.error(`   ❌ ${model.name} : ${err.message}`);
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
