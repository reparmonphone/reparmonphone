/**
 * Importe les produits iPad d'un CSV fournisseur vers le catalogue ReparMonPhone.
 *
 * Même logique que scripts/import-iphone-products.js : ce script NE CRÉE JAMAIS de nouvelle gamme
 * ni de nouveau modèle. Chaque produit du CSV est uniquement RATTACHÉ à un modèle iPad EXISTANT en
 * base (l'ordre et les catégories déjà en place ne bougent pas), retrouvé :
 *   1) par nom exact ("iPad Air 2 (2014)" en base == "iPad Air 2 (2014)" dans le CSV), sinon
 *   2) par nom normalisé (espaces/accents/casse ignorés), sinon
 *   3) par nom normalisé en ignorant le suffixe entre parenthèses.
 * Si aucune de ces trois méthodes ne trouve UNE SEULE correspondance sans ambiguïté, la ligne est
 * IGNORÉE (jamais assignée au hasard) et listée dans le rapport final pour contrôle manuel.
 *
 * Le CSV fournisseur contient aussi, à côté des iPad, quelques produits hors sujet (coques,
 * protections d'écran, iPhone 5/3GS, outils, MacBook...). Seules les lignes dont la catégorie
 * commence par "Apple > IPad" sont traitées ; les autres sont comptées à part et listées dans le
 * rapport, mais jamais importées par ce script.
 *
 * Les descriptions fournisseur contiennent encore l'ancienne formule marketing invérifiable
 * ("Leader en vente de pièces détachées de smartphones/tablettes/montres connectées aux
 * particuliers et professionnels" dans la description longue, "ReparMonPhone, principal grossiste
 * en pièces détachées/de rechange pour mobiles en Europe" dans la description courte) — déjà
 * corrigée sur les 1528 fiches existantes via scripts/fix-leader-claim-in-products.js. Ce script
 * applique la même correction AU MOMENT DE L'IMPORT, pour ne pas réintroduire le problème avec les
 * nouvelles fiches.
 *
 * Utilise csv-parse (déjà une dépendance du projet) plutôt qu'un parseur ligne à ligne fait main :
 * ce CSV contient des descriptions avec retours à la ligne à l'intérieur des champs.
 *
 * MODE DRY-RUN (fortement recommandé en premier — relis bien le rapport de correspondance) :
 *   node scripts/import-ipad-products.js scripts/Ipads.csv --dry-run
 *
 * MODE RÉEL :
 *   node scripts/import-ipad-products.js scripts/Ipads.csv
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { PrismaClient } = require('@prisma/client');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.join(__dirname, '../.env.migration') });

const prisma = new PrismaClient();
const isDryRun = process.argv.includes('--dry-run');
const csvPath = process.argv[2];

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || 'products';

const BRAND_SLUG = 'apple';
const SUPPLIER_BRAND_NAMES = /pieces ?2 ?mobile(\.com)?/gi;

// Formule de remplacement déjà validée avec Krys (cf. scripts/fix-leader-claim-in-products.js).
const NEW_PHRASE = 'Spécialiste français des pièces détachées pour smartphones et tablettes';

// Description longue : "Leader en vente de pièces détachées de [catégorie] aux particuliers et
// professionnels" -> remplacée par NEW_PHRASE, quelle que soit la catégorie citée.
const LONG_DESC_BOILERPLATE = /Leader en vente de pi[eè]ces d[ée]tach[ée]es de (?:smartphones|tablettes|montres connect[ée]es) aux particuliers et professionnels/gi;

// Description courte : "ReparMonPhone, principal grossiste en pièces détachées/de rechange pour
// mobiles en Europe." -> remplacée par une formule sobre cohérente avec NEW_PHRASE.
const SHORT_DESC_BOILERPLATE = /ReparMonPhone,\s*principal grossiste en pi[eè]ces (?:d[ée]tach[ée]es|de rechange) pour mobiles en Europe\.?/gi;
const SHORT_DESC_REPLACEMENT = `ReparMonPhone, ${NEW_PHRASE.charAt(0).toLowerCase()}${NEW_PHRASE.slice(1)}.`;

function cleanDescription(text, { isLong }) {
  if (!text) return text;
  let result = text.replace(SUPPLIER_BRAND_NAMES, 'ReparMonPhone');
  if (isLong) {
    result = result.replace(LONG_DESC_BOILERPLATE, NEW_PHRASE);
  } else {
    result = result.replace(SHORT_DESC_BOILERPLATE, SHORT_DESC_REPLACEMENT);
  }
  return result;
}

function slugify(s) {
  return s
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

// "iPad 4 (2012)" -> "iPad 4" — utilisé comme dernier recours de correspondance.
function stripParenthetical(s) {
  return s.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

// Correspondances confirmées à la main entre le nom "modèle" du CSV fournisseur et le slug du
// modèle existant en base, pour les cas où le nom est construit différemment des deux côtés (année
// dans la parenthèse côté fournisseur, hors parenthèse côté base — cf. scripts/diagnose-ipad-lines.js
// vs le rapport de ce script). Clé = nom CSV normalisé (accents/espaces/ponctuation/casse ignorés).
const MODEL_NAME_OVERRIDES = new Map(
  [
    ['iPad Pro 10.5" (2017)', 'ipad-pro-10-5-2017-1e-gen'],
    ['iPad Pro 11" (2018)', 'ipad-pro-11-2018-1e-gen'],
    ['iPad Pro 12.9" (2015)', 'ipad-pro-12-9-2015-1e-gen'],
    ['iPad Pro 12.9" (5ème Gen.) (2021)', 'ipad-pro-12-9-2021-5e-gen'],
    ['iPad Pro 12.9" (3ème Gen.) (2018)', 'ipad-pro-12-9-2018-3e-gen'],
    ['iPad Pro 12.9" (4ème Gen.) (2020)', 'ipad-pro-12-9-2020-4e-gen'],
    ['iPad Pro 12.9" (2ème Gen.) (2017)', 'ipad-pro-12-9-2017-2e-gen'],
    ['iPad Pro 11" (3ème Gen) (2021)', 'ipad-pro-11-2021-3e-gen'],
    ['iPad Pro 9.7" (2016)', 'ipad-pro-9-7-2016-1e-gen'],
    ['iPad Air 11" (6ème Gen.) (2024) (M2)', 'ipad-air-6-11-2024-m2'],
    ['iPad Air 13" (6ème Gen.) (2024) M2', 'ipad-air-6-13-2024-m2'],
    ['iPad (2010)', 'ipad-1-a1219-a1337'],
  ].map(([csvName, slug]) => [normalizeForComparison(csvName), slug])
);

// Lit le fichier en essayant l'UTF-8 d'abord ; si des caractères de remplacement apparaissent
// (signe d'un mauvais décodage), retente en Latin-1 — certains exports fournisseur ne sont
// pas encodés en UTF-8.
function readFileSmartEncoding(filePath) {
  const buffer = fs.readFileSync(filePath);
  const asUtf8 = buffer.toString('utf-8');
  if (asUtf8.includes('�')) {
    return buffer.toString('latin1');
  }
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

// Déduit la Gamme et le Modèle depuis la catégorie fournisseur
// (ex: "Apple > IPad > iPad Pro 10.5" (2017)" -> gamme="IPad", modele="iPad Pro 10.5" (2017)")
function parseCategory(categorie) {
  const parts = categorie.split('>').map((p) => p.trim());
  if (parts.length < 3) return null;
  return { racine: parts[0], gamme: parts[1], modele: parts[2] };
}

async function uniqueProductSlug(title) {
  const base = slugify(title) || 'produit';
  let slug = base;
  let i = 1;
  while (await prisma.product.findUnique({ where: { slug } })) {
    i += 1;
    slug = `${base}-${i}`;
  }
  return slug;
}

async function downloadAndUploadImage(imageUrl, supabase) {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const ext = (imageUrl.split('.').pop() || 'jpg').split('?')[0].slice(0, 5);
  const filename = `ipad/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabase.storage.from(SUPABASE_BUCKET).upload(filename, buffer, {
    contentType: res.headers.get('content-type') || 'image/jpeg',
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(filename);
  return data.publicUrl;
}

async function main() {
  if (!csvPath) {
    console.error('Usage : node scripts/import-ipad-products.js chemin/vers/fichier.csv [--dry-run]');
    process.exit(1);
  }
  if (!fs.existsSync(csvPath)) {
    console.error(`Fichier introuvable : ${csvPath}`);
    process.exit(1);
  }

  console.log(isDryRun ? 'MODE DRY-RUN - aucune ecriture ne sera faite.\n' : 'MODE REEL - le catalogue va etre modifie.\n');

  const allRows = parseCsv(csvPath);
  console.log(`${allRows.length} ligne(s) lue(s) dans le CSV fournisseur.\n`);

  // On ne garde que les lignes "Apple > IPad > ..." — le reste (coques, protections, iPhone,
  // outils, MacBook...) n'est pas dans le périmètre de cet import.
  const outOfScopeByCategory = new Map(); // categorie -> count
  const rows = [];
  for (const row of allRows) {
    const parsed = parseCategory(row['Categorie'] || '');
    const inScope = parsed && normalizeForComparison(parsed.gamme) === 'ipad';
    if (inScope) {
      rows.push(row);
    } else {
      const cat = (row['Categorie'] || '(catégorie vide)').trim();
      outOfScopeByCategory.set(cat, (outOfScopeByCategory.get(cat) || 0) + 1);
    }
  }

  console.log(`${rows.length} ligne(s) dans le périmètre "Apple > IPad" (les autres sont ignorées, voir rapport).\n`);

  const brand = await prisma.brand.findUnique({ where: { slug: BRAND_SLUG } });
  if (!brand) {
    console.error(`Marque introuvable en base (slug attendu : "${BRAND_SLUG}").`);
    process.exit(1);
  }

  // Toutes les gammes Apple, chargées une seule fois. Le fournisseur range TOUT sous une seule
  // catégorie "Apple > IPad > <modèle>", sans distinguer Pro / Air / Mini / standard — mais côté
  // ReparMonPhone, ces familles ont été séparées en plusieurs gammes distinctes ("iPad", "iPad
  // Pro", "iPad Mini", "iPad Air", cf. scripts/split-ipad-lines.js). On cherche donc le modèle
  // dans TOUTES les gammes Apple dont le nom contient "ipad" (comme scripts/diagnose-ipad-lines.js),
  // et pas seulement dans une gamme unique nommée exactement "iPad" — sinon tous les iPad Pro/Air/
  // Mini du CSV resteraient "sans correspondance" alors qu'ils existent bien, juste dans une autre
  // gamme.
  const allLines = await prisma.productLine.findMany({
    where: { brandId: brand.id },
    include: { models: true },
  });
  const ipadLines = allLines.filter((l) => normalizeForComparison(l.name).includes('ipad'));
  const ipadModelPool = ipadLines.flatMap((l) => l.models.map((m) => ({ ...m, lineName: l.name })));

  console.log(`${ipadLines.length} gamme(s) Apple "iPad*" trouvée(s) en base : ${ipadLines.map((l) => `"${l.name}"`).join(', ')} (${ipadModelPool.length} modèle(s) au total).\n`);

  // Retourne { model } si une correspondance NON AMBIGUË est trouvée, sinon { reason } expliquant
  // pourquoi la ligne doit être ignorée (aucun modèle, ou plusieurs candidats).
  function resolveModel(modeleName) {
    const exact = ipadModelPool.filter((m) => m.name === modeleName);
    if (exact.length === 1) return { model: exact[0], method: 'nom exact' };
    if (exact.length > 1) return { reason: `plusieurs modèles correspondent (nom exact) à "${modeleName}"` };

    const normTarget = normalizeForComparison(modeleName);
    const normalized = ipadModelPool.filter((m) => normalizeForComparison(m.name) === normTarget);
    if (normalized.length === 1) return { model: normalized[0], method: 'nom normalisé' };
    if (normalized.length > 1) return { reason: `plusieurs modèles correspondent (normalisé) à "${modeleName}"` };

    const stripped = normalizeForComparison(stripParenthetical(modeleName));
    const strippedMatches = ipadModelPool.filter((m) => normalizeForComparison(stripParenthetical(m.name)) === stripped);
    if (strippedMatches.length === 1) return { model: strippedMatches[0], method: 'nom sans référence' };
    if (strippedMatches.length > 1) return { reason: `plusieurs modèles correspondent (sans référence) à "${modeleName}"` };

    // Dernier recours : table de correspondance manuelle, pour les noms où le fournisseur et la
    // base construisent le nom différemment (ex: année dans la parenthèse côté fournisseur —
    // "iPad Pro 12.9" (2ème Gen.) (2017)" — mais hors parenthèse côté base — "iPad Pro 12.9" 2017
    // (2e Gen)") — repérée via scripts/diagnose-ipad-lines.js, confirmée un par un contre le rapport
    // de correspondance de ce script.
    const overrideSlug = MODEL_NAME_OVERRIDES.get(normTarget);
    if (overrideSlug) {
      const overrideModel = ipadModelPool.find((m) => m.slug === overrideSlug);
      if (overrideModel) return { model: overrideModel, method: 'correspondance manuelle (nommage fournisseur différent)' };
    }

    return { reason: `aucun modèle "${modeleName}" trouvé dans les gammes iPad* (${ipadLines.map((l) => l.name).join(', ')})` };
  }

  const existingProducts = await prisma.product.findMany({
    where: { model: { productLine: { brandId: brand.id } } },
    select: { title: true, slug: true },
  });
  const existingNormalized = new Map(existingProducts.map((p) => [normalizeForComparison(p.title), p]));

  // Regroupe les problèmes de correspondance par (gamme, modèle) plutôt que ligne par ligne — un
  // même modèle mal apparié revient souvent sur plusieurs produits, inutile de le répéter.
  const unmatched = new Map(); // key: "gamme::modele" -> { gamme, modele, count, reason, sample }
  const matchedByApproxMethod = new Map(); // idem, pour les correspondances non-exactes à faire relire

  let toCreate = 0;
  let toSkipDuplicate = 0;
  let toSkipUnmatched = 0;
  let imageFailures = 0;

  const supabase = !isDryRun && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    : null;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const nom = (row['Nom'] || '').trim();
    if (!nom) continue;

    const parsed = parseCategory(row['Categorie'] || '');
    const { gamme, modele } = parsed;

    const resolved = resolveModel(modele);

    if (!resolved.model) {
      const key = `${gamme}::${modele}`;
      const entry = unmatched.get(key) || { gamme, modele, count: 0, reason: resolved.reason, sample: nom };
      entry.count++;
      unmatched.set(key, entry);
      toSkipUnmatched++;
      continue;
    }

    if (resolved.method !== 'nom exact') {
      const key = `${gamme}::${modele}`;
      const entry = matchedByApproxMethod.get(key) || {
        gamme,
        modele,
        dbName: resolved.model.name,
        dbLine: resolved.model.lineName,
        method: resolved.method,
        count: 0,
      };
      entry.count++;
      matchedByApproxMethod.set(key, entry);
    }

    const normalizedTitle = normalizeForComparison(nom);
    const duplicate = existingNormalized.get(normalizedTitle);
    if (duplicate) {
      toSkipDuplicate++;
      continue;
    }

    toCreate++;

    if (!isDryRun) {
      let imageUrl = null;
      const sourceImageUrl = (row['URL_Image'] || '').trim();
      if (sourceImageUrl && supabase) {
        try {
          imageUrl = await downloadAndUploadImage(sourceImageUrl, supabase);
        } catch (e) {
          imageFailures++;
          console.log(`[${i + 1}/${rows.length}] ${nom.slice(0, 55)} -> image non recuperee (${e.message})`);
        }
      }

      const price = Number((row['Prix_TTC'] || '0').replace(',', '.')) || 0;
      const inStock = (row['Disponibilite'] || '').trim() === 'En stock';
      const shortDesc = cleanDescription((row['Description_Courte'] || '').trim(), { isLong: false }) || null;
      const longDesc = cleanDescription((row['Description_Longue'] || '').trim(), { isLong: true }) || null;
      const slug = await uniqueProductSlug(nom);

      await prisma.product.create({
        data: {
          title: nom,
          slug,
          price,
          inStock,
          shortDescription: shortDesc,
          description: longDesc,
          imageUrl,
          images: imageUrl ? [imageUrl] : [],
          pieceType: 'AUTRE',
          modelId: resolved.model.id,
          showInBoutique: true,
        },
      });
    }

    if ((i + 1) % 100 === 0 || i === rows.length - 1) {
      console.log(`... ${i + 1}/${rows.length} lignes traitées`);
    }
  }

  console.log('\n================ RAPPORT DE CORRESPONDANCE ================\n');

  if (outOfScopeByCategory.size > 0) {
    const totalOutOfScope = [...outOfScopeByCategory.values()].reduce((a, b) => a + b, 0);
    console.log(`ℹ️  ${totalOutOfScope} ligne(s) hors périmètre "Apple > IPad" — PAS importées par ce script :\n`);
    for (const [cat, count] of outOfScopeByCategory.entries()) {
      console.log(`   ${count} ligne(s) — "${cat}"`);
    }
    console.log('');
  }

  if (matchedByApproxMethod.size > 0) {
    console.log(`🟡 ${matchedByApproxMethod.size} modèle(s) apparié(s) SANS nom exactement identique — à relire :\n`);
    for (const { modele, dbName, dbLine, method, count } of matchedByApproxMethod.values()) {
      console.log(`   CSV "${modele}"  ->  base "${dbName}" (gamme "${dbLine}")  (${method}, ${count} produit(s))`);
    }
    console.log('');
  } else {
    console.log('✅ Tous les modèles appariés le sont par nom exactement identique.\n');
  }

  if (unmatched.size > 0) {
    console.log(`❌ ${unmatched.size} modèle(s) SANS AUCUNE correspondance en base — ${toSkipUnmatched} produit(s) ignoré(s), rien ne sera créé :\n`);
    for (const { gamme, modele, count, reason, sample } of unmatched.values()) {
      console.log(`   "${gamme} > ${modele}" (${count} produit(s), ex: "${sample.slice(0, 50)}") -> ${reason}`);
    }
    console.log('');
  } else {
    console.log('✅ Aucun modèle du CSV sans correspondance en base.\n');
  }

  console.log('-------------------------------------------------------------');
  console.log(`Produits ${isDryRun ? 'qui seraient crees' : 'crees'} : ${toCreate}`);
  console.log(`Doublons probables ignores (titre déjà en base) : ${toSkipDuplicate}`);
  console.log(`Produits ignorés (aucune correspondance de modèle) : ${toSkipUnmatched}`);
  if (!isDryRun) console.log(`Echecs de recuperation d'image : ${imageFailures}`);
  console.log('-------------------------------------------------------------\n');

  if (isDryRun) {
    console.log('Relis bien les sections ℹ️, 🟡 et ❌ ci-dessus avant de lancer en réel.');
    console.log('Pour appliquer réellement cet import (les lignes ❌ resteront ignorées) :');
    console.log(`   node scripts/import-ipad-products.js "${csvPath}"\n`);
  } else {
    console.log('Import terminé.\n');
  }
}

main()
  .catch((e) => {
    console.error('Erreur :', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
