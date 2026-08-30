/**
 * Crée les gammes ET modèles Samsung manquants en base, repérés par le rapport ❌ de
 * scripts/import-samsung-products.js (289 gamme/modèle manquants sur ~4145 produits).
 *
 * Contrairement à ce script d'import, celui-ci CRÉE ce qui manque (comme
 * scripts/import-huawei-products.js le fait), mais SANS PHOTO — les photos seront ajoutées plus
 * tard, un par un, depuis /admin/gammes (bouton 🖼️ modifier image, disponible maintenant aussi bien
 * pour les gammes que pour les modèles).
 *
 * Réutilise EXACTEMENT la même logique de correspondance que scripts/import-samsung-products.js
 * (avec le correctif "+" — voir ce script pour le détail du bug corrigé) pour ne créer QUE ce qui
 * manque vraiment, sans jamais dupliquer une gamme/un modèle déjà existant.
 *
 * MODE DRY-RUN (recommandé en premier) :
 *   node scripts/create-missing-samsung-categories.js scripts/Samsung.csv --dry-run
 *
 * MODE RÉEL :
 *   node scripts/create-missing-samsung-categories.js scripts/Samsung.csv
 *
 * Une fois lancé, relance l'import produits pour récupérer tout ce qui était bloqué :
 *   node scripts/import-samsung-products.js scripts/Samsung.csv
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: path.join(__dirname, '../.env.migration') });

const prisma = new PrismaClient();
const isDryRun = process.argv.includes('--dry-run');
const csvPath = process.argv[2];

const BRAND_SLUG = 'samsung';

function slugify(s) {
  // IMPORTANT : même traitement de "+" que dans import-samsung-products.js (converti en "plus"
  // avant nettoyage) — sinon "A8+ 2018" et "A8 2018" produiraient le même slug ("a8-2018"), ce qui
  // ferait échouer la création avec une erreur de contrainte unique (productLineId, slug).
  return s
    .replace(/\+/g, ' plus ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

function normalizeForComparison(s) {
  return slugify(s).replace(/-/g, '');
}

// Même correctif que import-samsung-products.js : retire TOUS les groupes entre parenthèses, pas
// seulement le dernier (ex: "A52 (A525F) / (A526B)" -> "A52"), pour matcher correctement les noms
// de modèles déjà nettoyés en base par cleanModelName ci-dessous.
function stripParenthetical(s) {
  return s.replace(/\s*\([^)]*\)/g, '').replace(/\s{2,}/g, ' ').trim();
}

// Nettoie un nom de modèle brut du CSV pour en faire un nom de modèle présentable : retire toutes
// les références entre parenthèses. NE retire PAS le préfixe du nom de la gamme (ex: gamme "Galaxy
// Z" -> modèle "Galaxy Z Flip4", pas juste "Flip4") : ce retrait de préfixe était appliqué de façon
// incohérente (certains modèles "Galaxy Z ..." le perdaient, d'autres comme "Galaxy Fold" non) et
// produisait des noms que le script d'import (import-samsung-products.js, qui ne retire jamais de
// préfixe de gamme) ne pouvait plus retrouver -> modèles créés mais jamais réappariés ensuite. Si
// des noms plus courts sont souhaités, ils peuvent être renommés depuis /admin/gammes.
function cleanModelName(raw) {
  const name = raw
    .replace(/\([^)]*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s*\/\s*$/, '')
    .replace(/^\s*\/\s*/, '')
    .trim();
  return name || raw.trim();
}

function readFileSmartEncoding(filePath) {
  const buffer = fs.readFileSync(filePath);
  const asUtf8 = buffer.toString('utf-8');
  if (asUtf8.includes('�')) return buffer.toString('latin1');
  return asUtf8;
}

function parseCsv(filePath) {
  const content = readFileSmartEncoding(filePath);
  return parse(content, {
    delimiter: ';',
    quote: '"',
    columns: true,
    bom: true,
    relax_column_count: true,
    skip_empty_lines: true,
    trim: false,
  });
}

function parseCategory(categorie) {
  const parts = categorie.split('>').map((p) => p.trim());
  if (parts.length < 3) return null;
  return { gamme: parts[1], modele: parts[2] };
}

async function main() {
  if (!csvPath || !fs.existsSync(csvPath)) {
    console.error('Usage : node scripts/create-missing-samsung-categories.js chemin/vers/Samsung.csv [--dry-run]');
    process.exit(1);
  }

  console.log(isDryRun ? '🧪 MODE DRY-RUN — aucune écriture ne sera faite.\n' : '⚠️  MODE RÉEL — la base va être modifiée.\n');

  const rows = parseCsv(csvPath);
  console.log(`${rows.length} produits lus dans le CSV fournisseur.\n`);

  const brand = await prisma.brand.findUnique({ where: { slug: BRAND_SLUG } });
  if (!brand) {
    console.error(`❌ Marque introuvable en base (slug attendu : "${BRAND_SLUG}").`);
    process.exit(1);
  }

  // État courant des gammes/modèles Samsung, mis à jour au fil de la création (pour ne jamais
  // créer deux fois la même chose au sein d'un même passage, même en mode dry-run).
  const lines = await prisma.productLine.findMany({ where: { brandId: brand.id }, include: { models: true } });

  function findLine(gammeName) {
    return (
      lines.find((l) => l.name === gammeName) ||
      lines.find((l) => normalizeForComparison(l.name) === normalizeForComparison(gammeName))
    );
  }

  function resolveModel(gammeName, modeleName) {
    const line = findLine(gammeName);
    if (!line) return { reason: 'gamme introuvable' };

    const exact = line.models.filter((m) => m.name === modeleName);
    if (exact.length === 1) return { model: exact[0] };

    const normTarget = normalizeForComparison(modeleName);
    const normalized = line.models.filter((m) => normalizeForComparison(m.name) === normTarget);
    if (normalized.length === 1) return { model: normalized[0] };
    if (normalized.length > 1) return { reason: 'ambigu (normalisé)' };

    const stripped = normalizeForComparison(stripParenthetical(modeleName));
    const strippedMatches = line.models.filter((m) => normalizeForComparison(stripParenthetical(m.name)) === stripped);
    if (strippedMatches.length === 1) return { model: strippedMatches[0] };
    if (strippedMatches.length > 1) return { reason: 'ambigu (sans référence)' };

    return { reason: 'modèle introuvable' };
  }

  // Regroupe les lignes du CSV par (gamme, modèle) — inutile de traiter 40 fois la même création.
  const uniquePairs = new Map(); // key: "gamme::modele" -> { gamme, modele, count }
  for (const row of rows) {
    const parsed = parseCategory(row['Categorie'] || '');
    if (!parsed) continue;
    const key = `${parsed.gamme}::${parsed.modele}`;
    const entry = uniquePairs.get(key) || { gamme: parsed.gamme, modele: parsed.modele, count: 0 };
    entry.count++;
    uniquePairs.set(key, entry);
  }

  let linesCreated = 0;
  let modelsCreated = 0;
  let skippedAmbiguous = 0;
  const createdLinesLog = [];
  const createdModelsLog = new Map(); // gamme -> [modelName, ...]

  for (const { gamme, modele, count } of uniquePairs.values()) {
    const resolved = resolveModel(gamme, modele);
    if (resolved.model) continue; // déjà en base, rien à faire

    if (resolved.reason === 'ambigu (normalisé)' || resolved.reason === 'ambigu (sans référence)') {
      console.log(`   ⚠️  SKIP (ambigu, contrôle manuel nécessaire) : "${gamme} > ${modele}" (${count} produit(s)) -> ${resolved.reason}`);
      skippedAmbiguous++;
      continue;
    }

    let line = findLine(gamme);
    if (!line) {
      const slug = slugify(gamme);
      if (isDryRun) {
        line = { id: `dryrun-${slug}`, name: gamme, slug, models: [] };
      } else {
        line = await prisma.productLine.create({ data: { name: gamme, slug, brandId: brand.id } });
        line.models = [];
      }
      lines.push(line);
      linesCreated++;
      createdLinesLog.push(gamme);
    }

    const modelName = cleanModelName(modele);
    // IMPORTANT : la vérification "déjà en base" doit se faire par NOM NORMALISÉ, pas par slug.
    // Bug corrigé : comparer par slug faisait sauter à tort la création de modèles légitimement
    // distincts (ex: "S10") quand leur slug calculé collait avec le slug HÉRITÉ (généré avant le
    // correctif "+") d'un autre modèle déjà en base (ex: ancien slug "s10" attribué à "S10+" avant
    // que le "+" ne soit converti en "plus"). Comparer par nom normalisé (qui applique le même
    // correctif "+") évite cette fausse collision.
    const normName = normalizeForComparison(modelName);
    if (line.models.some((m) => normalizeForComparison(m.name) === normName)) continue;

    // Le slug, lui, doit rester unique en base (contrainte @@unique([productLineId, slug])) : si un
    // ancien modèle a par coïncidence le même slug calculé (sans être le même nom, sinon on aurait
    // déjà "continue" juste au-dessus), on désambiguïse plutôt que de silencieusement sauter la
    // création.
    let slug = slugify(modelName);
    if (line.models.some((m) => m.slug === slug)) {
      let suffix = 2;
      while (line.models.some((m) => m.slug === `${slug}-${suffix}`)) suffix++;
      slug = `${slug}-${suffix}`;
    }

    if (!isDryRun) {
      const created = await prisma.model.create({ data: { name: modelName, slug, productLineId: line.id } });
      line.models.push(created);
    } else {
      line.models.push({ id: `dryrun-${slug}`, name: modelName, slug });
    }
    modelsCreated++;
    const log = createdModelsLog.get(gamme) || [];
    log.push(`${modelName}  (${count} produit(s), CSV: "${modele}")`);
    createdModelsLog.set(gamme, log);
  }

  console.log('================ RÉSUMÉ ================\n');
  if (createdLinesLog.length > 0) {
    console.log(`🆕 ${linesCreated} nouvelle(s) gamme(s) ${isDryRun ? 'à créer' : 'créée(s)'} :`);
    createdLinesLog.forEach((g) => console.log(`   - ${g}`));
    console.log('');
  }
  console.log(`🆕 ${modelsCreated} nouveau(x) modèle(s) ${isDryRun ? 'à créer' : 'créé(s)'} :\n`);
  for (const [gamme, models] of createdModelsLog.entries()) {
    console.log(`   Gamme "${gamme}" (${models.length}) :`);
    models.forEach((m) => console.log(`      - ${m}`));
  }
  if (skippedAmbiguous > 0) {
    console.log(`\n⚠️  ${skippedAmbiguous} cas ambigu(s) laissé(s) de côté (contrôle manuel nécessaire).`);
  }
  console.log('\n------------------------------------------');
  console.log(`Gammes ${isDryRun ? 'à créer' : 'créées'} : ${linesCreated}`);
  console.log(`Modèles ${isDryRun ? 'à créer' : 'créés'} : ${modelsCreated}`);
  console.log('------------------------------------------\n');

  if (isDryRun) {
    console.log('Pour appliquer réellement, relance sans --dry-run :');
    console.log(`   node scripts/create-missing-samsung-categories.js "${csvPath}"\n`);
  } else {
    console.log('✅ Terminé. Relance maintenant l\'import produits pour récupérer ce qui était bloqué :');
    console.log(`   node scripts/import-samsung-products.js "${csvPath}"\n`);
  }
}

main()
  .catch((e) => {
    console.error('💥 Erreur :', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
