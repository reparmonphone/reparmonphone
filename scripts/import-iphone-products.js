/**
 * Importe les produits iPhone d'un CSV fournisseur vers le catalogue ReparMonPhone.
 *
 * Contrairement à scripts/import-huawei-products.js, ce script NE CRÉE JAMAIS de nouvelle
 * gamme ni de nouveau modèle : toutes les gammes/modèles Apple > iPhone sont déjà en base, avec
 * leurs bonnes images. Chaque produit du CSV est donc uniquement RATTACHÉ à un modèle EXISTANT,
 * retrouvé :
 *   1) par nom exact ("iPhone 14 Pro Max" en base == "iPhone 14 Pro Max" dans le CSV), sinon
 *   2) par nom normalisé (espaces/accents/casse ignorés), sinon
 *   3) par nom normalisé en ignorant le suffixe entre parenthèses (ex: CSV "iPhone 4
 *      (A1349 / A1332)" -> "iPhone 4" si la base a juste "iPhone 4").
 * Si aucune de ces trois méthodes ne trouve UNE SEULE correspondance sans ambiguïté, la ligne est
 * IGNORÉE (jamais assignée au hasard) et listée dans le rapport final pour contrôle manuel — même
 * en mode réel.
 *
 * Utilise csv-parse (déjà une dépendance du projet) plutôt qu'un parseur ligne à ligne fait main :
 * ce CSV contient des descriptions avec retours à la ligne à l'intérieur des champs, que scinder
 * bêtement sur "\n" casserait (vérifié : 62 lignes du fichier concernées).
 *
 * MODE DRY-RUN (fortement recommandé en premier — relis bien le rapport de correspondance) :
 *   node scripts/import-iphone-products.js scripts/Iphone.csv --dry-run
 *
 * MODE RÉEL :
 *   node scripts/import-iphone-products.js scripts/Iphone.csv
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
const LINE_NAME = 'iPhone';
const SUPPLIER_BRAND_NAMES = /pieces ?2 ?mobile(\.com)?/gi;

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

// "iPhone 4 (A1349 / A1332)" -> "iPhone 4" — utilisé comme dernier recours de correspondance.
function stripParenthetical(s) {
  return s.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

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
// (ex: "Apple > iPhone > iPhone 4 (A1349 / A1332)" -> gamme="iPhone", modele="iPhone 4 (A1349 / A1332)")
function parseCategory(categorie) {
  const parts = categorie.split('>').map((p) => p.trim());
  if (parts.length < 3) return null;
  return { gamme: parts[1], modele: parts[2] };
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
  const filename = `iphone/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

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
    console.error('Usage : node scripts/import-iphone-products.js chemin/vers/fichier.csv [--dry-run]');
    process.exit(1);
  }
  if (!fs.existsSync(csvPath)) {
    console.error(`Fichier introuvable : ${csvPath}`);
    process.exit(1);
  }

  console.log(isDryRun ? 'MODE DRY-RUN - aucune ecriture ne sera faite.\n' : 'MODE REEL - le catalogue va etre modifie.\n');

  const rows = parseCsv(csvPath);
  console.log(`${rows.length} produits lus dans le CSV fournisseur.\n`);

  const brand = await prisma.brand.findUnique({ where: { slug: BRAND_SLUG } });
  if (!brand) {
    console.error(`Marque introuvable en base (slug attendu : "${BRAND_SLUG}").`);
    process.exit(1);
  }

  // Toutes les gammes Apple + tous leurs modèles, chargés une seule fois : la correspondance se
  // fait ensuite en mémoire, sans recréer quoi que ce soit.
  const lines = await prisma.productLine.findMany({
    where: { brandId: brand.id },
    include: { models: true },
  });

  function findLine(gammeName) {
    return (
      lines.find((l) => l.name === gammeName) ||
      lines.find((l) => normalizeForComparison(l.name) === normalizeForComparison(gammeName))
    );
  }

  // Retourne { model } si une correspondance NON AMBIGUË est trouvée, sinon { reason } expliquant
  // pourquoi la ligne doit être ignorée (aucune gamme, aucun modèle, ou plusieurs candidats).
  function resolveModel(gammeName, modeleName) {
    const line = findLine(gammeName);
    if (!line) return { reason: `gamme "${gammeName}" introuvable en base` };

    const exact = line.models.filter((m) => m.name === modeleName);
    if (exact.length === 1) return { model: exact[0], method: 'nom exact' };

    const normTarget = normalizeForComparison(modeleName);
    const normalized = line.models.filter((m) => normalizeForComparison(m.name) === normTarget);
    if (normalized.length === 1) return { model: normalized[0], method: 'nom normalisé' };
    if (normalized.length > 1) return { reason: `plusieurs modèles correspondent (normalisé) à "${modeleName}"` };

    const stripped = normalizeForComparison(stripParenthetical(modeleName));
    const strippedMatches = line.models.filter((m) => normalizeForComparison(stripParenthetical(m.name)) === stripped);
    if (strippedMatches.length === 1) return { model: strippedMatches[0], method: 'nom sans référence (A1234...)' };
    if (strippedMatches.length > 1) return { reason: `plusieurs modèles correspondent (sans référence) à "${modeleName}"` };

    return { reason: `aucun modèle "${modeleName}" trouvé dans la gamme "${line.name}"` };
  }

  const existingProducts = await prisma.product.findMany({
    where: { model: { productLine: { brandId: brand.id } } },
    select: { title: true, slug: true },
  });
  const existingNormalized = new Map(existingProducts.map((p) => [normalizeForComparison(p.title), p]));

  // Regroupe les problèmes de correspondance par (gamme, modèle) plutôt que ligne par ligne — un
  // même modèle mal apparié revient souvent sur des dizaines de produits, inutile de le répéter.
  const unmatched = new Map(); // key: "gamme::modele" -> { gamme, modele, count, reason, sample }
  const matchedByApproxMethod = new Map(); // idem, pour les correspondances non-exactes à faire relire

  let toCreate = 0;
  let toSkipDuplicate = 0;
  let toSkipUnmatched = 0;
  let imageFailures = 0;
  let skippedNoCategory = 0;

  const supabase = !isDryRun && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    : null;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const nom = (row['Nom'] || '').trim();
    if (!nom) continue;

    const parsed = parseCategory(row['Categorie'] || '');
    if (!parsed) {
      skippedNoCategory++;
      continue;
    }
    const { gamme, modele } = parsed;

    const resolved = resolveModel(gamme, modele);

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
      const shortDesc = (row['Description_Courte'] || '').trim().replace(SUPPLIER_BRAND_NAMES, 'ReparMonPhone') || null;
      const longDesc = (row['Description_Longue'] || '').trim().replace(SUPPLIER_BRAND_NAMES, 'ReparMonPhone') || null;
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

  if (matchedByApproxMethod.size > 0) {
    console.log(`🟡 ${matchedByApproxMethod.size} modèle(s) apparié(s) SANS nom exactement identique — à relire :\n`);
    for (const { gamme, modele, dbName, method, count } of matchedByApproxMethod.values()) {
      console.log(`   CSV "${modele}"  ->  base "${dbName}"  (${method}, ${count} produit(s))`);
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
  if (skippedNoCategory > 0) console.log(`Lignes ignorées (colonne Categorie inattendue) : ${skippedNoCategory}`);
  if (!isDryRun) console.log(`Echecs de recuperation d'image : ${imageFailures}`);
  console.log('-------------------------------------------------------------\n');

  if (isDryRun) {
    console.log('Relis bien les sections 🟡 et ❌ ci-dessus avant de lancer en réel.');
    console.log('Pour appliquer réellement cet import (les lignes ❌ resteront ignorées) :');
    console.log(`   node scripts/import-iphone-products.js "${csvPath}"\n`);
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
