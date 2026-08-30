/**
 * Ajoute la référence constructeur exacte (celle entre parenthèses dans le CSV fournisseur) au nom
 * de chaque modèle Samsung en base, ex: "S24 Ultra" -> "S24 Ultra (S928B)". Objectif : que la
 * référence exacte soit visible partout (admin/gammes, page publique /marque/samsung/...), pour
 * qu'il n'y ait plus jamais de confusion entre deux modèles au nom proche (ex: A7 / A70 / A7 2017 /
 * A7 2018 — quatre modèles bien distincts, avec quatre références différentes).
 *
 * Réutilise EXACTEMENT la même logique de correspondance que scripts/import-samsung-products.js
 * (nom exact -> nom normalisé -> nom sans référence) pour relier chaque modèle déjà en base à sa
 * ligne CSV, puis en extrait la ou les références entre parenthèses.
 *
 * Cas particulier "A72 4G (A725F) / A72 5G (A726B)" : le CSV fournisseur réunit volontairement DEUX
 * téléphones différents (4G et 5G, références différentes) dans une seule catégorie, car certaines
 * pièces (l'écran, par ex.) sont vendues comme compatibles avec les deux variantes à la fois. On ne
 * sépare donc PAS ce modèle en deux (ça masquerait ces pièces communes aux clients de l'une ou
 * l'autre variante) : on se contente de le renommer proprement. Voir SPECIAL_NAME_OVERRIDES.
 *
 * Ne touche JAMAIS le slug (l'URL /marque/samsung/... reste stable) : seul le "name" affiché change.
 * Idempotent : relancer ce script après coup ne fait rien sur les modèles déjà à jour.
 *
 * MODE DRY-RUN (recommandé en premier) :
 *   node scripts/add-samsung-reference-codes.js scripts/Samsung.csv --dry-run
 * MODE RÉEL :
 *   node scripts/add-samsung-reference-codes.js scripts/Samsung.csv
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

// Voir le commentaire d'en-tête : ce modèle réunit volontairement deux téléphones différents dans
// une seule catégorie fournisseur (pièces communes aux deux variantes) — on ne le sépare pas, on le
// renomme juste pour que les deux références soient lisibles.
const SPECIAL_NAME_OVERRIDES = {
  'A72 4G / A72 5G': 'A72 4G/5G (A725F / A726B)',
  // Reliquat du "/" de fin issu du nettoyage automatique (voir cleanModelName dans
  // create-missing-samsung-categories.js) : le CSV a 3 références pour ce SEUL modèle (variantes
  // opérateur), pas 3 modèles différents — contrairement à "A72 4G / A72 5G" ci-dessus.
  'A14 4G /': 'A14 4G (A145F / A145P / A145R)',
  // Idem : "S20 FE 5G / 5G" vient de "S20 FE 5G (G781B) / 5G (G781U)" — un seul modèle (5G), deux
  // références SKU opérateur différentes. Le "S20 FE 5G" répété deux fois dans le nom d'origine est
  // un artefact de nettoyage à corriger, pas une vraie distinction.
  'S20 FE 5G / 5G': 'S20 FE 5G (G781B / G781U)',
};

function slugifyCompare(s) {
  return s
    .replace(/\+/g, ' plus ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}
function stripParenthetical(s) {
  return s.replace(/\s*\([^)]*\)/g, '').replace(/\s{2,}/g, ' ').trim();
}
function extractCodes(s) {
  const matches = [...s.matchAll(/\(([^)]*)\)/g)];
  return matches.map((m) => m[1].trim()).filter(Boolean);
}
function readFileSmartEncoding(filePath) {
  const buffer = fs.readFileSync(filePath);
  const asUtf8 = buffer.toString('utf-8');
  return asUtf8.includes('�') ? buffer.toString('latin1') : asUtf8;
}
function parseCsv(filePath) {
  const content = readFileSmartEncoding(filePath);
  return parse(content, { delimiter: ';', quote: '"', columns: true, bom: true, relax_column_count: true, skip_empty_lines: true, trim: false });
}
function parseCategory(categorie) {
  const parts = categorie.split('>').map((p) => p.trim());
  if (parts.length < 3) return null;
  return { gamme: parts[1], modele: parts[2] };
}

async function main() {
  if (!csvPath || !fs.existsSync(csvPath)) {
    console.error('Usage : node scripts/add-samsung-reference-codes.js scripts/Samsung.csv [--dry-run]');
    process.exit(1);
  }
  console.log(isDryRun ? '🧪 MODE DRY-RUN — aucune écriture ne sera faite.\n' : '⚠️  MODE RÉEL — la base va être modifiée.\n');

  const rows = parseCsv(csvPath);

  // Regroupe les lignes CSV par (gamme, nom-sans-référence normalisé) — exactement la clé de
  // correspondance "tier 3" utilisée à l'import — et cumule tous les codes rencontrés pour ce groupe.
  const groupsByGamme = new Map(); // gamme -> Map(normalizedStripped -> { codes: Set, rawVariants: Set })
  for (const row of rows) {
    const parsed = parseCategory(row['Categorie'] || '');
    if (!parsed) continue;
    const { gamme, modele } = parsed;
    const key = slugifyCompare(stripParenthetical(modele));
    const gammeMap = groupsByGamme.get(gamme) || new Map();
    const entry = gammeMap.get(key) || { codes: new Set(), rawVariants: new Set() };
    entry.rawVariants.add(modele);
    for (const c of extractCodes(modele)) entry.codes.add(c);
    gammeMap.set(key, entry);
    groupsByGamme.set(gamme, gammeMap);
  }

  const brand = await prisma.brand.findUnique({ where: { slug: BRAND_SLUG } });
  if (!brand) {
    console.error(`Marque introuvable en base (slug attendu : "${BRAND_SLUG}").`);
    process.exit(1);
  }
  const lines = await prisma.productLine.findMany({ where: { brandId: brand.id }, include: { models: true } });

  function findGammeGroups(gammeName) {
    if (groupsByGamme.has(gammeName)) return groupsByGamme.get(gammeName);
    for (const [g, map] of groupsByGamme.entries()) {
      if (slugifyCompare(g) === slugifyCompare(gammeName)) return map;
    }
    return null;
  }

  const toRename = []; // { line, model, oldName, newName }
  const alreadyUpToDate = [];
  const noCsvMatch = [];
  const ambiguous = [];

  for (const line of lines) {
    const gammeGroups = findGammeGroups(line.name);
    if (!gammeGroups) {
      for (const model of line.models) noCsvMatch.push({ line, model });
      continue;
    }

    // Repère, DANS CETTE GAMME, les modèles qui partagent la même clé "sans référence" (ne devrait
    // normalement jamais arriver grâce au correctif anti-collision de create-missing-samsung-categories.js,
    // mais on vérifie quand même par prudence avant de renommer).
    const modelsByKey = new Map();
    for (const model of line.models) {
      const key = slugifyCompare(stripParenthetical(model.name));
      const arr = modelsByKey.get(key) || [];
      arr.push(model);
      modelsByKey.set(key, arr);
    }

    for (const [key, models] of modelsByKey.entries()) {
      if (models.length > 1) {
        for (const model of models) ambiguous.push({ line, model, reason: `${models.length} modèles partagent la même clé "${key}" dans cette gamme` });
        continue;
      }
      const model = models[0];
      const override = SPECIAL_NAME_OVERRIDES[model.name];
      if (override) {
        if (override === model.name) alreadyUpToDate.push({ line, model });
        else toRename.push({ line, model, oldName: model.name, newName: override });
        continue;
      }

      const group = gammeGroups.get(key);
      if (!group || group.codes.size === 0) {
        noCsvMatch.push({ line, model });
        continue;
      }
      const codes = [...group.codes];
      // Construit le nouveau nom à partir du nom SANS parenthèse existante (et pas du nom brut), pour
      // ne jamais ré-ajouter un code déjà présent (ex: un modèle déjà renommé "S21+ 5G (G996B)" par un
      // script précédent ne doit pas devenir "S21+ 5G (G996B) (G996B)").
      const baseName = stripParenthetical(model.name);
      const newName = `${baseName} (${codes.join(' / ')})`;
      if (newName === model.name) {
        alreadyUpToDate.push({ line, model });
      } else {
        toRename.push({ line, model, oldName: model.name, newName });
      }
    }
  }

  console.log('================ RAPPORT ================\n');

  console.log(`✅ ${toRename.length} modèle(s) à renommer avec leur référence exacte :\n`);
  for (const { line, oldName, newName } of toRename) {
    console.log(`   [${line.name}] "${oldName}"  ->  "${newName}"`);
  }

  if (ambiguous.length > 0) {
    console.log(`\n⚠️  ${ambiguous.length} modèle(s) ambigu(s) — laissés INCHANGÉS, à vérifier manuellement :\n`);
    for (const { line, model, reason } of ambiguous) {
      console.log(`   [${line.name}] "${model.name}" -> ${reason}`);
    }
  }

  if (noCsvMatch.length > 0) {
    console.log(`\nℹ️  ${noCsvMatch.length} modèle(s) sans correspondance dans ce CSV — laissés INCHANGÉS (créés manuellement, ou via un autre import) :\n`);
    for (const { line, model } of noCsvMatch) {
      console.log(`   [${line.name}] "${model.name}"`);
    }
  }

  console.log(`\n(${alreadyUpToDate.length} modèle(s) déjà à jour, ignorés.)`);
  console.log('\n-------------------------------------------------------------');

  if (!isDryRun) {
    for (const { model, newName } of toRename) {
      await prisma.model.update({ where: { id: model.id }, data: { name: newName } });
    }
    console.log(`✅ ${toRename.length} modèle(s) renommé(s).`);
  } else {
    console.log('Relis bien le rapport ci-dessus avant de lancer en réel.');
    console.log(`Pour appliquer réellement : node scripts/add-samsung-reference-codes.js "${csvPath}"`);
  }
}

main()
  .catch((e) => {
    console.error('💥 Erreur :', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
