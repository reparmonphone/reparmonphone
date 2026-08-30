/**
 * Complément en lecture seule à scripts/reclassify-samsung-legacy-products.js : ce dernier a mis de
 * côté 431 produits en catégorie "unknownCode" (une référence constructeur est bien présente dans le
 * titre, mais ne correspond à AUCUN modèle "précis" actuel). On sait déjà que l'écrasante majorité
 * vient d'un angle mort du diagnostic : les modèles Galaxy Z ont été fusionnés à la main dans l'admin
 * sous des noms informels ("Z Fold 5" au lieu de "Galaxy Z Fold5 5G (F946B)"), donc leurs produits
 * sont presque certainement déjà au bon endroit.
 *
 * Ce script sépare automatiquement ces deux cas :
 *   - Galaxy Z (déjà géré à la main par toi) -> juste compté, pas détaillé.
 *   - Tout le reste (S21+, S21 Ultra, S5 Active, A50s, A53, A10/M10, J4/J7, Watch/Gear...) -> pour
 *     CHAQUE référence inconnue, on vérifie :
 *       1) si elle existe QUELQUE PART dans le CSV fournisseur (et sous quelle Catégorie exacte) ;
 *       2) la liste de TOUS les modèles Samsung actuels de cette gamme (avec leur nb de produits),
 *          pour repérer si un modèle correspondant existe déjà sous un autre nom, ou s'il faut en
 *          créer un nouveau.
 *
 * Ne modifie jamais rien.
 *   node scripts/investigate-unknown-codes.js scripts/Samsung.csv
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: path.join(__dirname, '../.env.migration') });

const prisma = new PrismaClient();
const csvPath = process.argv[2];
const BRAND_SLUG = 'samsung';

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
function extractRefCandidates(title) {
  const groups = [...title.matchAll(/\(([^)]*)\)/g)].map((m) => m[1]);
  const out = [];
  for (const g of groups) {
    for (const piece of g.split('/')) {
      const t = piece.trim().toUpperCase();
      if (t) out.push(t);
    }
  }
  return out;
}

async function main() {
  if (!csvPath || !fs.existsSync(csvPath)) {
    console.error('Usage : node scripts/investigate-unknown-codes.js scripts/Samsung.csv');
    process.exit(1);
  }

  const rows = parseCsv(csvPath);
  const groupsByGamme = new Map(); // gamme -> Map(key -> Set(codes))
  const codeToCategorie = new Map(); // code -> Set("gamme > modele")
  for (const row of rows) {
    const parsed = parseCategory(row['Categorie'] || '');
    if (!parsed) continue;
    const key = slugifyCompare(stripParenthetical(parsed.modele));
    const gammeMap = groupsByGamme.get(parsed.gamme) || new Map();
    const codes = gammeMap.get(key) || new Set();
    for (const c of [...parsed.modele.matchAll(/\(([^)]*)\)/g)].map((m) => m[1].trim().toUpperCase())) {
      codes.add(c);
      const set = codeToCategorie.get(c) || new Set();
      set.add(`${parsed.gamme} > ${parsed.modele}`);
      codeToCategorie.set(c, set);
    }
    gammeMap.set(key, codes);
    groupsByGamme.set(parsed.gamme, gammeMap);
  }
  function findGammeGroups(gammeName) {
    if (groupsByGamme.has(gammeName)) return groupsByGamme.get(gammeName);
    for (const [g, map] of groupsByGamme.entries()) {
      if (slugifyCompare(g) === slugifyCompare(gammeName)) return map;
    }
    return null;
  }

  const brand = await prisma.brand.findUnique({ where: { slug: BRAND_SLUG } });
  const lines = await prisma.productLine.findMany({
    where: { brandId: brand.id },
    include: { models: { include: { _count: { select: { products: true } } } } },
  });

  const codeToModel = new Map(); // code -> { model, line } | 'AMBIGUOUS'
  const preciseModelsByLine = new Map();
  for (const line of lines) {
    const gammeGroups = findGammeGroups(line.name);
    const preciseIds = new Set();
    if (gammeGroups) {
      for (const model of line.models) {
        const key = slugifyCompare(stripParenthetical(model.name));
        const codes = gammeGroups.get(key);
        if (codes && codes.size > 0) {
          preciseIds.add(model.id);
          for (const code of codes) {
            if (codeToModel.has(code) && codeToModel.get(code) !== 'AMBIGUOUS' && codeToModel.get(code).model.id !== model.id) {
              codeToModel.set(code, 'AMBIGUOUS');
            } else if (!codeToModel.has(code)) {
              codeToModel.set(code, { model, line });
            }
          }
        }
      }
    }
    preciseModelsByLine.set(line.id, preciseIds);
  }

  const legacyModels = [];
  for (const line of lines) {
    const preciseIds = preciseModelsByLine.get(line.id);
    for (const model of line.models) {
      if (!preciseIds.has(model.id)) legacyModels.push({ line, model });
    }
  }

  // unknownCode uniquement (on ne recalcule pas moves/ambiguous/noTitleCode, déjà validés par
  // reclassify-samsung-legacy-products.js) : code -> { count, fromBuckets: Set("line/model") }
  const unknownCodeStats = new Map();
  let zSeriesUnknownCount = 0;
  const zSeriesCodesSeen = new Set();

  for (const { line, model } of legacyModels) {
    const products = await prisma.product.findMany({ where: { modelId: model.id }, select: { id: true, title: true } });
    for (const product of products) {
      const candidates = extractRefCandidates(product.title);
      const targets = new Map();
      let sawAmbiguousCode = false;
      const unknownCodesInTitle = [];
      for (const code of candidates) {
        const hit = codeToModel.get(code);
        if (hit === 'AMBIGUOUS') sawAmbiguousCode = true;
        else if (hit) targets.set(hit.model.id, hit);
        else unknownCodesInTitle.push(code);
      }
      const isUnknownCase = targets.size === 0 && !sawAmbiguousCode && unknownCodesInTitle.length > 0;
      if (!isUnknownCase) continue;

      if (line.name.toLowerCase().includes('galaxy z')) {
        zSeriesUnknownCount++;
        for (const c of unknownCodesInTitle) zSeriesCodesSeen.add(c);
        continue;
      }
      for (const code of unknownCodesInTitle) {
        const stat = unknownCodeStats.get(code) || { count: 0, buckets: new Set() };
        stat.count++;
        stat.buckets.add(`${line.name}/${model.name}`);
        unknownCodeStats.set(code, stat);
      }
    }
  }

  console.log('================ RAPPORT — références inconnues (hors Galaxy Z) ================\n');
  console.log(
    `ℹ️  Galaxy Z : ${zSeriesUnknownCount} produit(s) avec une référence non reconnue, codes : ${[...zSeriesCodesSeen].join(', ') || '(aucun)'}\n` +
      `   -> quasi certainement déjà correctement placés (tu as fusionné ces modèles à la main). Rien à faire ici sauf indication contraire.\n`
  );

  const sortedCodes = [...unknownCodeStats.entries()].sort((a, b) => b[1].count - a[1].count);
  console.log(`🔎 ${sortedCodes.length} référence(s) inconnue(s) distincte(s) en dehors de Galaxy Z, pour ${sortedCodes.reduce((s, [, v]) => s + v.count, 0)} produit(s) :\n`);

  for (const [code, stat] of sortedCodes) {
    console.log(`--- "${code}" (${stat.count} produit(s), actuellement dans : ${[...stat.buckets].join(' ; ')}) ---`);

    const foundIn = codeToCategorie.get(code);
    if (foundIn) {
      console.log(`   ✅ trouvée dans le CSV fournisseur sous : ${[...foundIn].join(' | ')}`);
    } else {
      console.log(`   ❌ ABSENTE du CSV fournisseur (aucune ligne ne cite cette référence) — probablement un accessoire (montre/bracelet) ou un modèle hors périmètre de ce fichier.`);
    }

    // Liste tous les modèles actuels (précis + hérités) de la/les gammes concernées (celle du bucket
    // ET celle trouvée dans le CSV si différente), pour repérer un modèle déjà existant sous un autre nom.
    const gammeNamesToShow = new Set();
    for (const bucketKey of stat.buckets) gammeNamesToShow.add(bucketKey.split('/')[0]);
    if (foundIn) {
      for (const entry of foundIn) gammeNamesToShow.add(entry.split(' > ')[0]);
    }
    for (const gammeName of gammeNamesToShow) {
      const line = lines.find((l) => slugifyCompare(l.name) === slugifyCompare(gammeName));
      if (!line) {
        console.log(`   (gamme "${gammeName}" introuvable en base)`);
        continue;
      }
      console.log(`   Modèles actuels dans [${line.name}] :`);
      for (const m of line.models) {
        console.log(`      - "${m.name}" (${m._count.products} produit(s))`);
      }
    }
    console.log('');
  }
}

main()
  .catch((e) => {
    console.error('💥 Erreur :', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
