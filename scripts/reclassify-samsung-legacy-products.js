/**
 * Reclasse, PRODUIT PAR PRODUIT, les pièces actuellement rangées dans un "vieux" modèle Samsung
 * hérité (celui repéré par scripts/diagnose-samsung-legacy-models.js — ex: "A14", "S21+", "Z Flip 4",
 * "A25 / A34 / A54 / A55") vers le modèle précis correspondant (ex: "A14 4G (A145F / A145P / A145R)"),
 * en lisant la référence constructeur EXACTE présente dans le TITRE de chaque produit — jamais son nom
 * de modèle actuel, ni son gamme d'origine.
 *
 * Principe (le même que demandé : "reprendre chaque titre pour reclasser correctement chaque pièce
 * dans le bon modèle") :
 *   1) On construit, à partir du CSV fournisseur, la table [référence constructeur -> modèle précis]
 *      (ex: A145F -> "A14 4G", A146B -> "A14 5G", A725F ET A726B -> "A72 4G/5G" — ce dernier cas
 *      ressort naturellement du même calcul, sans traitement spécial : le CSV réunit déjà A725F et
 *      A726B sous la même catégorie fournisseur, donc les deux codes pointent vers le même modèle).
 *   2) Pour chaque produit d'un vieux modèle, on extrait TOUTES les références entre parenthèses de
 *      son titre et on les cherche dans cette table.
 *   3) Si TOUTES les références trouvées pointent vers le MÊME modèle précis -> on déplace le produit
 *      (sûr, sans ambiguïté).
 *   4) Si le titre contient des références de PLUSIEURS modèles précis différents (ex: une batterie
 *      vendue compatible A55/A54/A34/A25 à la fois) -> on NE TOUCHE PAS (impossible de choisir un
 *      seul modèle sans se tromper), listé pour vérification manuelle.
 *   5) Si aucune référence reconnue n'est trouvée dans le titre -> on NE TOUCHE PAS non plus (ex: un
 *      titre qui ne cite qu'une référence de pièce détachée comme "EB-BF927ABY", pas une référence de
 *      téléphone), listé pour vérification manuelle.
 *
 * Un vieux modèle qui se retrouve à 0 produit après ce script peut ensuite être supprimé directement
 * depuis /admin/gammes (le bouton 🗑 se débloque automatiquement dès que le modèle est vide).
 *
 * MODE DRY-RUN (fortement recommandé en premier — relis bien le rapport) :
 *   node scripts/reclassify-samsung-legacy-products.js scripts/Samsung.csv --dry-run
 * MODE RÉEL :
 *   node scripts/reclassify-samsung-legacy-products.js scripts/Samsung.csv
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
// Extrait chaque référence individuelle d'un titre : "(A145P) / (A145R)" -> ["A145P","A145R"],
// "(A125 / A127 )" -> ["A125","A127"], "(SM-C101)" -> ["SM-C101"].
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
    console.error('Usage : node scripts/reclassify-samsung-legacy-products.js scripts/Samsung.csv [--dry-run]');
    process.exit(1);
  }
  console.log(isDryRun ? '🧪 MODE DRY-RUN — aucune écriture ne sera faite.\n' : '⚠️  MODE RÉEL — la base va être modifiée.\n');

  const rows = parseCsv(csvPath);
  const groupsByGamme = new Map(); // gamme -> Map(key -> Set(codes))
  for (const row of rows) {
    const parsed = parseCategory(row['Categorie'] || '');
    if (!parsed) continue;
    const key = slugifyCompare(stripParenthetical(parsed.modele));
    const gammeMap = groupsByGamme.get(parsed.gamme) || new Map();
    const codes = gammeMap.get(key) || new Set();
    for (const c of [...parsed.modele.matchAll(/\(([^)]*)\)/g)].map((m) => m[1].trim())) codes.add(c.toUpperCase());
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
  const lines = await prisma.productLine.findMany({ where: { brandId: brand.id }, include: { models: true } });

  // Table [référence -> modèle précis] construite depuis les modèles PRÉCIS déjà en base (ceux qui
  // ont une correspondance CSV — donc PAS les vieux modèles hérités qu'on cherche justement à vider).
  // Une référence trouvée dans plusieurs modèles précis différents est écartée (collision, on ne
  // devine pas).
  const codeToModel = new Map(); // code -> { model, line } | 'AMBIGUOUS'
  const preciseModelsByLine = new Map(); // line.id -> Set(modelId) des modèles "précis" (matchés au CSV)

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

  // Les "vieux" modèles = ceux qui n'ont PAS de correspondance CSV directe (mêmes critère que
  // scripts/diagnose-samsung-legacy-models.js).
  const legacyModels = [];
  for (const line of lines) {
    const preciseIds = preciseModelsByLine.get(line.id);
    for (const model of line.models) {
      if (!preciseIds.has(model.id)) legacyModels.push({ line, model });
    }
  }

  const moves = []; // { product, from, to }
  const ambiguous = []; // { product, from, targets: [names] }
  // IMPORTANT distinction, pour ne pas confondre deux situations très différentes :
  //   - noTitleCode  : le titre ne contient AUCUNE référence entre parenthèses -> rien à en tirer.
  //   - unknownCode  : le titre contient bien une référence (ex: "(F946B)"), mais elle n'est reconnue
  //     par AUCUN modèle précis actuel -> soit ce modèle précis a été renommé/fusionné entre-temps
  //     sous un nom qui ne correspond plus au CSV (ex: "Galaxy Z Fold5 5G" renommé en "Z Fold 5" à la
  //     main), soit il n'a jamais été créé. Dans les deux cas, rien n'est déplacé PAR PRUDENCE — mais
  //     contrairement à noTitleCode, ça vaut le coup de vérifier si le produit est déjà au bon endroit.
  const noTitleCode = [];
  const unknownCode = [];

  for (const { line, model } of legacyModels) {
    const products = await prisma.product.findMany({ where: { modelId: model.id }, select: { id: true, title: true } });
    for (const product of products) {
      const candidates = extractRefCandidates(product.title);
      const targets = new Map(); // modelId -> { model, line }
      let sawAmbiguousCode = false;
      let sawUnknownCode = false;
      for (const code of candidates) {
        const hit = codeToModel.get(code);
        if (hit === 'AMBIGUOUS') sawAmbiguousCode = true;
        else if (hit) targets.set(hit.model.id, hit);
        else sawUnknownCode = true;
      }
      if (targets.size === 1 && !sawAmbiguousCode) {
        const target = [...targets.values()][0];
        moves.push({ product, from: { line, model }, to: target });
      } else if (targets.size > 1) {
        ambiguous.push({ product, from: { line, model }, targets: [...targets.values()].map((t) => `${t.line.name}/${t.model.name}`) });
      } else if (sawUnknownCode) {
        unknownCode.push({ product, from: { line, model }, codes: candidates });
      } else {
        noTitleCode.push({ product, from: { line, model } });
      }
    }
  }

  console.log('================ RAPPORT ================\n');
  console.log(`✅ ${moves.length} produit(s) à déplacer vers leur modèle précis (référence non ambiguë) :\n`);
  const movesByFromTo = new Map();
  for (const { from, to } of moves) {
    const key = `${from.line.name}/${from.model.name} -> ${to.line.name}/${to.model.name}`;
    movesByFromTo.set(key, (movesByFromTo.get(key) || 0) + 1);
  }
  for (const [key, count] of [...movesByFromTo.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`   ${count.toString().padStart(3)}  ${key}`);
  }

  if (ambiguous.length > 0) {
    console.log(`\n⚠️  ${ambiguous.length} produit(s) AMBIGU(S) — référence(s) pointant vers plusieurs modèles différents, laissés INCHANGÉS :\n`);
    for (const { product, from, targets } of ambiguous) {
      console.log(`   [${from.line.name}/${from.model.name}] "${product.title}" -> ${[...new Set(targets)].join(' OU ')}`);
    }
  }

  if (unknownCode.length > 0) {
    console.log(
      `\n🔶 ${unknownCode.length} produit(s) avec une référence dans le titre qui ne correspond à AUCUN modèle précis actuel — ` +
        `soit ce modèle a été renommé/fusionné entre-temps (ex: "Galaxy Z Fold5 5G" -> "Z Fold 5" à la main) et le produit est` +
        ` peut-être déjà au bon endroit, soit le modèle précis n'a jamais été créé. Regroupés par (vieux modèle -> référence introuvable) :\n`
    );
    const byBucket = new Map(); // "line/model" -> Map(code -> {count, sample})
    for (const { product, from, codes } of unknownCode) {
      const bucketKey = `${from.line.name}/${from.model.name}`;
      const bucket = byBucket.get(bucketKey) || new Map();
      for (const code of codes) {
        if (codeToModel.get(code)) continue; // ce code-ci a résolu, seul un AUTRE code du même titre est en cause
        const entry = bucket.get(code) || { count: 0, sample: product.title };
        entry.count++;
        bucket.set(code, entry);
      }
      byBucket.set(bucketKey, bucket);
    }
    for (const [bucketKey, codes] of byBucket.entries()) {
      console.log(`   [${bucketKey}] :`);
      for (const [code, { count, sample }] of [...codes.entries()].sort((a, b) => b[1].count - a[1].count)) {
        console.log(`      "${code}" (${count} produit(s), ex: "${sample.slice(0, 70)}")`);
      }
    }
  }

  if (noTitleCode.length > 0) {
    console.log(`\nℹ️  ${noTitleCode.length} produit(s) SANS aucune référence entre parenthèses dans le titre — laissés INCHANGÉS. Groupés par vieux modèle :\n`);
    const byBucket = new Map();
    for (const { from } of noTitleCode) {
      const key = `${from.line.name}/${from.model.name}`;
      byBucket.set(key, (byBucket.get(key) || 0) + 1);
    }
    for (const [key, count] of [...byBucket.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`   ${count.toString().padStart(3)}  ${key}`);
    }
  }

  console.log('\n-------------------------------------------------------------');

  if (!isDryRun) {
    for (const { product, to } of moves) {
      await prisma.product.update({ where: { id: product.id }, data: { modelId: to.model.id } });
    }
    console.log(`✅ ${moves.length} produit(s) déplacé(s).`);
    console.log('Astuce : va dans /admin/gammes, les vieux modèles maintenant à 0 produit peuvent être supprimés (bouton 🗑, débloqué automatiquement).');
  } else {
    console.log('Relis bien le rapport ci-dessus avant de lancer en réel.');
    console.log(`Pour appliquer réellement : node scripts/reclassify-samsung-legacy-products.js "${csvPath}"`);
  }
}

main()
  .catch((e) => {
    console.error('💥 Erreur :', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
