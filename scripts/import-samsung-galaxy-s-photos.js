// Importe les photos des modèles Samsung Galaxy S (dossier local avec mapping.csv) vers
// Model.imageUrl (affiché sur /marque/samsung/galaxy-s).
//
// Source des photos : C:\Users\Pc-Krys\Pictures\00 ReparMonPhone\Samsung\GALAXY S\images
//   -> un sous-dossier par modèle (ex: "S24 Ultra\S24 Ultra.jpg")
//   -> mapping.csv à la racine liste chaque modèle (colonne nom_modele) et son dossier
//      local (colonne dossier_local, généralement identique à nom_modele).
//
// Les noms de modèles en base contiennent le code référence entre parenthèses
// (ex: "S24 Ultra (S928B)") — ce script ignore cette partie pour faire correspondre au
// nom du dossier local. Les variantes 4G/5G (ex: dossier "S10 4G - S10 5G" qui doit
// s'appliquer à la fois au modèle "S10" et au modèle "S10 5G") sont gérées automatiquement.
//
// Usage :
//   node scripts/import-samsung-galaxy-s-photos.js --dry-run   (rapport seulement, aucune écriture)
//   node scripts/import-samsung-galaxy-s-photos.js             (upload + mise à jour réelle)

require('dotenv').config({ path: require('path').join(__dirname, '../.env.migration') });
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { createClient } = require('@supabase/supabase-js');

const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes('--dry-run');
const IMAGES_DIR = 'C:\\Users\\Pc-Krys\\Pictures\\00 ReparMonPhone\\Samsung\\GALAXY S\\images';
const MAPPING_CSV = path.join(IMAGES_DIR, 'mapping.csv');
const BUCKET = process.env.SUPABASE_BUCKET || 'products';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function guessContentType(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const map = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };
  return map[ext] || 'application/octet-stream';
}

function normalize(raw) {
  return raw
    .replace(/\s*\([^)]*\)\s*$/, '') // retire "(CODE)" en fin de nom
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s*\+/g, '+') // "S10 +" -> "S10+"
    .toUpperCase();
}

function stripGeneration(s) {
  return s.replace(/\b(4G|5G)\b/gi, '').replace(/\s+/g, ' ').trim();
}

function namesMatch(a, b) {
  if (a === b) return true;
  return stripGeneration(a) === stripGeneration(b) && stripGeneration(a).length > 0;
}

function parseMappingCsv(content) {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const rows = [];
  for (let i = 1; i < lines.length; i++) { // skip header
    const parts = lines[i].split(',');
    if (parts.length < 5) continue;
    const nom_modele = parts[0].trim();
    const dossier_local = parts[parts.length - 1].trim();
    rows.push({ nom_modele, dossier_local });
  }
  return rows;
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants dans .env.migration');
  }
  if (!fs.existsSync(MAPPING_CSV)) {
    throw new Error(`mapping.csv introuvable : ${MAPPING_CSV}`);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const mappingRows = parseMappingCsv(fs.readFileSync(MAPPING_CSV, 'utf8'));

  const brand = await prisma.brand.findFirst({ where: { slug: 'samsung' } });
  if (!brand) throw new Error('Marque "samsung" introuvable (slug attendu: samsung).');

  const line = await prisma.productLine.findFirst({ where: { brandId: brand.id, slug: 'galaxy-s' } });
  if (!line) throw new Error('Gamme "galaxy-s" introuvable pour Samsung (slug attendu: galaxy-s).');

  const models = await prisma.model.findMany({ where: { productLineId: line.id } });

  console.log(`${models.length} modèle(s) trouvé(s) dans Samsung > Galaxy S.`);
  console.log(`${mappingRows.length} ligne(s) dans mapping.csv.`);
  console.log(DRY_RUN ? '\n--- MODE DRY-RUN (aucune écriture) ---\n' : '\n--- IMPORT RÉEL ---\n');

  const matchedModelIds = new Set();
  const usedMappingRows = new Set();
  let updated = 0;
  let skippedMissingFile = 0;

  for (const model of models) {
    const dbNorm = normalize(model.name);

    // Cherche une ligne mapping correspondante — soit directement, soit en éclatant les
    // dossiers combinés du type "S10 4G - S10 5G" en plusieurs sous-noms.
    let match = null;
    for (const row of mappingRows) {
      const candidateNames = row.nom_modele.includes(' - ')
        ? row.nom_modele.split(' - ').map((s) => normalize(s))
        : [normalize(row.nom_modele)];
      if (candidateNames.some((c) => namesMatch(dbNorm, c))) {
        match = row;
        break;
      }
    }

    if (!match) {
      console.log(`  [SANS PHOTO] "${model.name}" — aucune correspondance trouvée dans mapping.csv`);
      continue;
    }

    const imagePath = path.join(IMAGES_DIR, match.dossier_local, `${match.dossier_local}.jpg`);
    if (!fs.existsSync(imagePath)) {
      console.log(`  [FICHIER MANQUANT] "${model.name}" -> ${imagePath}`);
      skippedMissingFile++;
      continue;
    }

    matchedModelIds.add(model.id);
    usedMappingRows.add(match.dossier_local);

    if (DRY_RUN) {
      console.log(`  [OK] "${model.name}" <- ${match.dossier_local}\\${match.dossier_local}.jpg`);
      continue;
    }

    const buffer = fs.readFileSync(imagePath);
    const ext = path.extname(imagePath).slice(1) || 'jpg';
    const storagePath = `categories/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
      contentType: guessContentType(imagePath),
      upsert: false,
    });
    if (uploadError) {
      console.log(`  [ERREUR UPLOAD] "${model.name}": ${uploadError.message}`);
      continue;
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    await prisma.model.update({ where: { id: model.id }, data: { imageUrl: data.publicUrl } });
    console.log(`  [IMPORTÉ] "${model.name}" -> ${data.publicUrl}`);
    updated++;
  }

  const unmatchedModels = models.filter((m) => !matchedModelIds.has(m.id));
  const unusedMappingRows = mappingRows.filter((r) => !usedMappingRows.has(r.dossier_local));

  console.log('\n--- RÉSUMÉ ---');
  console.log(`Modèles avec photo trouvée : ${matchedModelIds.size} / ${models.length}`);
  if (!DRY_RUN) console.log(`Photos importées avec succès : ${updated}`);
  if (skippedMissingFile > 0) console.log(`Fichiers image manquants sur le disque : ${skippedMissingFile}`);
  if (unmatchedModels.length > 0) {
    console.log(`\nModèles SANS photo (à vérifier manuellement) :`);
    unmatchedModels.forEach((m) => console.log(`  - ${m.name}`));
  }
  if (unusedMappingRows.length > 0) {
    console.log(`\nDossiers du mapping.csv non utilisés (aucun modèle "${line.name}" correspondant) :`);
    // Diagnostic : cherche si un modèle portant ce nom existe ailleurs dans le catalogue Samsung
    // (autre gamme mal classée) ou s'il n'existe carrément aucun modèle pour cette variante.
    const allSamsungModels = await prisma.model.findMany({
      where: { productLine: { brandId: brand.id } },
      include: { productLine: true },
    });
    const elsewhere = allSamsungModels.filter((m) => m.productLineId !== line.id);

    for (const row of unusedMappingRows) {
      const rowNorm = normalize(row.nom_modele);
      const found = elsewhere.find((m) => namesMatch(normalize(m.name), rowNorm));
      if (found) {
        console.log(`  - ${row.dossier_local} : existe sous "${found.name}" mais dans la gamme "${found.productLine.name}" (pas Galaxy S)`);
      } else {
        console.log(`  - ${row.dossier_local} : aucun modèle correspondant nulle part dans le catalogue Samsung — probablement jamais créé`);
      }
    }
  }
  if (DRY_RUN) {
    console.log('\nRelance sans --dry-run pour appliquer réellement l\'import.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
