/**
 * Importe les OUTILS du fournisseur (testeurs, colles, tournevis, soudure, puces JCID, machines…) présents
 * dans le CSV "produits fournisseur absents de ton site", quelle que soit la catégorie du CSV
 * (Samsung, Apple/iPhone, iPad, Accessoires…) : ce sont les lignes dont le fil d'Ariane commence par "Outils".
 *
 * Même règles que scripts/import-supplier-products.js :
 *   - marque "Outils" (slug "outils"), gammes "Accessoires" ou "Reprogrammation" selon la table ci-dessous,
 *     modèles = sous-catégories (Soudure, Testeur, Programmation, Colle…) créés si besoin
 *   - type de pièce OUTILLAGE, textes nettoyés (Pieces2mobile -> ReparMonPhone, livraison 250 €, etc.)
 *   - photo téléchargée et réhébergée sur Supabase avec une pause entre chaque image
 *   - doublon (titre déjà en base) ignoré ; prix > 300 € ignorés et listés (à vérifier : machines ou prix fictifs)
 *
 * La table de correspondance reprend celle de ton import d'origine, complétée pour les sous-catégories
 * qu'elle ne couvrait pas (signalées "nouveau" dans le rapport).
 *
 * Usage :
 *   node scripts/import-supplier-outils.js scripts/produits_fournisseur_absents_de_ton_site_2026-10-04.csv --dry-run
 *   node scripts/import-supplier-outils.js scripts/produits_fournisseur_absents_de_ton_site_2026-10-04.csv
 * Options : --limit N   --max-price 300
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { PrismaClient } = require('@prisma/client');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.join(__dirname, '../.env.migration') });

const prisma = new PrismaClient();
const argv = process.argv;
const csvPath = argv[2];
const isDryRun = argv.includes('--dry-run');
function argValue(name) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : null;
}
const LIMIT = argValue('--limit') ? parseInt(argValue('--limit'), 10) : Infinity;
const MAX_PRICE = argValue('--max-price') ? Number(argValue('--max-price')) : 300;

const CACHE_FILE = path.join(__dirname, 'cache', 'supplier-details.json');
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || 'products';
const USER_AGENT = 'ReparMonPhone-catalogue-sync/1.0 (contact@reparmonphone.fr)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (min, max) => Math.floor(min + Math.random() * (max - min));

// ---------------- utilitaires ----------------

function slugify(s) {
  return s
    .replace(/\+/g, ' plus ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}
function norm(s) {
  return slugify(s).replace(/-/g, '');
}
function stripParenthetical(s) {
  return s.replace(/\s*\([^)]*\)/g, '').replace(/\s{2,}/g, ' ').trim();
}
// Clé de comparaison tolérante : sans parenthèses, sans préfixe "Galaxy", et pour les pliables Samsung
// sans "5G" final ("Galaxy Z Flip8 5G (F776B)" == "Z Flip 8"). Ne touche PAS aux "4G/5G" des autres modèles
// (A18 4G et A18 5G restent deux modèles distincts).
function looseKey(s) {
  let k = norm(stripParenthetical(s)).replace(/^galaxy/, '');
  if (/^z(fold|flip)/.test(k)) k = k.replace(/(5g|4g)$/, '');
  return k;
}
// Nom à donner à un modèle Samsung créé, dans TON format : "Galaxy Z Fold8 Ultra 5G (F976B)" -> "Z Fold 8 Ultra".
function samsungCreateName(modele) {
  let n = stripParenthetical(modele) || modele;
  if (/^Galaxy Z (Fold|Flip)/i.test(n)) {
    n = n.replace(/^Galaxy\s+/i, '').replace(/^(Z (?:Fold|Flip))\s*(\d)/i, '$1 $2').replace(/\s+[45]G$/i, '').trim();
  }
  return n;
}
function readCsv(filePath) {
  const buffer = fs.readFileSync(filePath);
  let content = buffer.toString('utf-8');
  if (content.includes('�')) content = buffer.toString('latin1');
  return parse(content, { delimiter: ';', quote: '"', columns: true, bom: true, relax_column_count: true, skip_empty_lines: true, trim: false });
}

// ---------------- nettoyage des textes ----------------

const SUPPLIER_BRAND_NAMES = /pieces ?2 ?mobile(\.com)?/gi;
const NEW_DELIVERY = "Livraison gratuite dès 250€ d'achat en France métropolitaine.";
const LEADER_NEW = 'Spécialiste français des pièces détachées pour smartphones et tablettes';
const LEADER_OLD = [
  'Leader en vente de pièces détachées de smartphones aux particuliers et professionnels',
  'Leader en vente de pièces détachées de tablettes aux particuliers et professionnels',
  'Leader en vente de pièces détachées de montres connectées aux particuliers et professionnels',
];
function cleanText(text) {
  let t = (text || '').trim().replace(SUPPLIER_BRAND_NAMES, 'ReparMonPhone');
  t = t.split('Envois gratuits dès 35 euros.').join(NEW_DELIVERY);
  t = t.replace(/ ?Comptes professionnels\.?\s*/g, ' ');
  for (const old of LEADER_OLD) t = t.split(old).join(LEADER_NEW);
  return t.replace(/\s{2,}/g, ' ').trim();
}


// ---------------- table de correspondance fournisseur -> gamme / modèle ----------------

const normPath = (s) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’‘`]/g, "'").replace(/\s*>\s*/g, ' > ').replace(/\s+/g, ' ').trim();

const A = 'Accessoires';
const R = 'Reprogrammation';
// [chemin fournisseur, gamme, modèle, nouveau?]
const MAP_ROWS = [
  // --- table d'origine (import-supplier-products.js) ---
  ['Outils > Ouverture > Ventouse', A, 'Ouverture'],
  ['Outils > Démontage - Montage > Tournevis', A, 'Tournevis'],
  ['Outils > Tournevis', A, 'Tournevis'],
  ['Outils > Colle, Adhésif et Dissolvant > Adhésif', A, 'Colle'],
  ['Outils > Consommable > Colle / Adhésif', A, 'Colle'],
  ['Outils > Pince > Brucelle', A, 'Pince'],
  ['Outils > Programmation > Module de reprogrammation', R, 'Programmation'],
  ['Outils > Programmation > Plaque / Nappe de reprogrammation', R, 'Programmation'],
  ['Outils > Autres', A, 'Autres'],
  ['Outils > Autres > Autres', A, 'Autres'],
  ['Outils > Autres > Tapis Isolant', A, 'Autres'],
  ['Outils > Consommable > Soudure', A, 'Soudure'],
  ['Outils > Consommable > Panne / Buse', A, 'Soudure'],
  ['Outils > Soudure > Extracteur de fumée', A, 'Soudure'],
  ['Outils > Soudure > Plaque de rebillage', A, 'Soudure'],
  ['Outils > Soudure > Séparateur de carte mère', A, 'Soudure'],
  ['Outils > Kit Outils', A, 'Kit Outils'],
  ["Outils > Machine > Décolleuse d'écran", A, 'Machine'],
  ['Outils > Machine > Laser', A, 'Machine'],
  ['Outils > Redressement et Ajustement', A, 'Redressement'],
  ['Outils > Testeur et Alimentation > Chargeur Batterie', R, 'Testeur'],
  ['Outils > Testeur et Alimentation > Station Alimentation', R, 'Testeur'],
  ['Outils > Testeur et Alimentation > Testeur carte mère', R, 'Testeur'],
  ['Outils > Testeur et Alimentation > Testeur écran / Nappe TEST > DIANL DL400 Pro Testeur Ecran', R, 'Testeur'],
  // --- ajouts (sous-catégories non couvertes par la table d'origine) ---
  ['Outils > Testeur et Alimentation > Testeur écran / Nappe TEST', R, 'Testeur', true],
  ['Outils > Testeur et Alimentation > Câble d\u2019alimentation', R, 'Testeur', true],
  ['Outils > Testeur et Alimentation > Testeur magnétique recharge sans fil', R, 'Testeur', true],
  ['Outils > Diagnostics et Mesures', R, 'Testeur', true],
  ['Outils > YCS > Testeur', R, 'Testeur', true],
  ['Outils > JCID', R, 'Programmation', true],
  ['Outils > QIANLI / MEGA-IDEA', R, 'Programmation', true],
  ['Outils > Programmation > Stand de Restauration', R, 'Programmation', true],
  ['Outils > Soudure', A, 'Soudure', true],
  ['Outils > Soudure > Support de réparation', A, 'Soudure', true],
  ['Outils > Soudure > Soudure par points', A, 'Soudure', true],
  ['Outils > Soudure > Panne / Buse', A, 'Soudure', true],
  ['Outils > Colle, Adhésif et Dissolvant > Colle', A, 'Colle', true],
  ['Outils > Colle, Adhésif et Dissolvant > Dissolvant', A, 'Colle', true],
  ['Outils > Machine', A, 'Machine', true],
  ['Outils > Machine > Lampe UV', A, 'Machine', true],
  ['Outils > Démontage - Montage > Presse écran', A, 'Machine', true],
  ['Outils > Démontage - Montage > CNC', A, 'Machine', true],
  ['Outils > Démontage - Montage > Ouverture', A, 'Ouverture', true],
  ['Outils > Démontage - Montage > Kit outils', A, 'Kit Outils', true],
  ['Outils > Ouverture > Spatule', A, 'Ouverture', true],
  ['Outils > Nettoyage et Désoxydation', A, 'Autres', true],
];
const TOOL_MAP = new Map(MAP_ROWS.map(([k, g, m, n]) => [normPath(k), { gamme: g, modele: m, isNew: !!n }]));
const FALLBACK = { gamme: A, modele: 'Autres', isNew: true, fallback: true };

function mapTool(parts) {
  for (let n = parts.length; n >= 1; n--) {
    const hit = TOOL_MAP.get(normPath(parts.slice(0, n).join(' > ')));
    if (hit) return hit;
  }
  return FALLBACK;
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

let imagesDisabled = false;
let consecutiveBlocked = 0;
async function downloadAndUploadImage(imageUrl, supabase, folder) {
  await sleep(rand(800, 1600)); // courte pause entre deux téléchargements chez le fournisseur
  const res = await fetch(imageUrl, { headers: { 'User-Agent': USER_AGENT } });
  if (res.status === 403 || res.status === 429 || res.status === 503) {
    consecutiveBlocked++;
    if (consecutiveBlocked >= 3) imagesDisabled = true;
    throw new Error(`HTTP ${res.status}`);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  consecutiveBlocked = 0;
  const buffer = Buffer.from(await res.arrayBuffer());
  const ext = (imageUrl.split('.').pop() || 'jpg').split('?')[0].slice(0, 5);
  const filename = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(SUPABASE_BUCKET).upload(filename, buffer, {
    contentType: res.headers.get('content-type') || 'image/jpeg',
    upsert: false,
  });
  if (error) throw error;
  return supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(filename).data.publicUrl;
}


async function main() {
  if (!csvPath || !fs.existsSync(csvPath)) {
    console.error('Usage : node scripts/import-supplier-outils.js chemin/vers/fichier.csv [--dry-run] [--limit N] [--max-price 300]');
    process.exit(1);
  }
  if (!fs.existsSync(CACHE_FILE)) {
    console.error("Cache introuvable (scripts/cache/supplier-details.json).");
    process.exit(1);
  }
  console.log('Version du script : outils v1');
  console.log(isDryRun ? 'MODE DRY-RUN — aucune écriture, aucune image téléchargée.\n' : 'MODE RÉEL — le catalogue va être modifié.\n');

  const brand = await prisma.brand.findUnique({ where: { slug: 'outils' } });
  if (!brand) {
    console.error('Marque "Outils" introuvable en base (slug "outils"). Dis-le moi, on ajustera.');
    process.exit(1);
  }
  const lines = await prisma.productLine.findMany({ where: { brandId: brand.id }, include: { models: true } });

  const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
  const rows = readCsv(csvPath);
  const existingTitles = new Set((await prisma.product.findMany({ select: { title: true } })).map((p) => norm(p.title)));
  const supabase = !isDryRun && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) : null;

  const report = {
    tools: 0, duplicates: 0, expensive: [], fallback: new Map(), newMapped: new Map(), usage: new Map(),
    linesToCreate: new Set(), modelsToCreate: new Set(), created: 0, noImage: 0, imageFailures: 0, notFetched: 0,
  };

  for (const row of rows) {
    if (report.created >= LIMIT) { console.log(`\nLimite de ${LIMIT} produit(s) atteinte.`); break; }
    const sku = (row['Reference_SKU'] || '').trim();
    const nom = (row['Nom'] || '').trim();
    if (!sku || !nom) continue;
    const entry = cache[sku];
    if (!entry) { report.notFetched++; continue; }
    if (entry.status !== 'ok') continue;

    let parts = (entry.breadcrumb || []).map((p) => p.trim()).filter(Boolean);
    if (parts.length && /^(accueil|home)$/i.test(parts[0])) parts = parts.slice(1);
    if (parts.length && (norm(parts[parts.length - 1]) === norm(nom) || norm(parts[parts.length - 1]) === norm(entry.title || ''))) parts = parts.slice(0, -1);
    if (!parts.length || !/^outils?$/i.test(parts[0])) continue; // pas un outil

    report.tools++;
    if (existingTitles.has(norm(nom))) { report.duplicates++; continue; }

    const price = Number(String(row['Prix_TTC'] || '0').replace(',', '.')) || 0;
    if (price > MAX_PRICE) { report.expensive.push(`${nom.slice(0, 70)} (${price.toFixed(2)} €, ${(row['Disponibilite'] || '').trim()})`); continue; }

    const map = mapTool(parts);
    const key = `${map.gamme} > ${map.modele}`;
    report.usage.set(key, (report.usage.get(key) || 0) + 1);
    if (map.fallback) {
      const p = parts.join(' > ');
      report.fallback.set(p, (report.fallback.get(p) || 0) + 1);
    } else if (map.isNew) {
      const p = parts.join(' > ');
      report.newMapped.set(`${p}  =>  ${key}`, (report.newMapped.get(`${p}  =>  ${key}`) || 0) + 1);
    }

    // --- gamme / modèle (créés si besoin) ---
    let line = lines.find((l) => norm(l.name) === norm(map.gamme));
    if (!line) {
      report.linesToCreate.add(map.gamme);
      line = isDryRun
        ? { id: null, name: map.gamme, models: [] }
        : Object.assign(await prisma.productLine.create({ data: { name: map.gamme, slug: slugify(map.gamme), brandId: brand.id } }), { models: [] });
      lines.push(line);
    }
    let model = line.models.find((m) => norm(m.name) === norm(map.modele));
    if (!model) {
      report.modelsToCreate.add(`${map.gamme} > ${map.modele}`);
      if (isDryRun) {
        model = { id: null, name: map.modele };
      } else {
        let slug = slugify(map.modele);
        let n = 1;
        while (line.models.some((m) => m.slug === slug)) { n++; slug = `${slugify(map.modele)}-${n}`; }
        model = await prisma.model.create({ data: { name: map.modele, slug, productLineId: line.id } });
      }
      line.models.push(model);
    }

    report.created++;
    existingTitles.add(norm(nom));
    if (isDryRun) continue;

    const inStock = (row['Disponibilite'] || '').trim() === 'En stock';
    const longDesc = cleanText(entry.longDescription) || null;
    const shortDesc = cleanText(entry.shortDescription) || (longDesc ? longDesc.slice(0, 160) : null);
    let imageUrl = null;
    const src = (entry.image || '').trim();
    if (!src || /placeholder|photo-generique/i.test(src)) {
      report.noImage++;
    } else if (supabase && !imagesDisabled) {
      try {
        imageUrl = await downloadAndUploadImage(src, supabase, 'outils');
      } catch (e) {
        report.imageFailures++;
        console.log(`   image non récupérée pour "${nom.slice(0, 50)}" (${e.message})`);
        if (imagesDisabled) console.log("   Le fournisseur refuse les images (403/429) : téléchargements d'images arrêtés pour ce lancement.");
      }
    } else {
      report.noImage++;
    }
    const slug = await uniqueProductSlug(nom);
    await prisma.product.create({
      data: {
        title: nom, slug, price, inStock,
        shortDescription: shortDesc, description: longDesc,
        imageUrl, images: imageUrl ? [imageUrl] : [],
        pieceType: 'OUTILLAGE', modelId: model.id, showInBoutique: true,
      },
    });
    if (report.created % 25 === 0) console.log(`... ${report.created} produit(s) créé(s)`);
  }

  console.log('\n================ RAPPORT ================\n');
  console.log(`${report.tools} outil(s) trouvé(s) dans le CSV.\n`);
  console.log('Répartition (gamme > modèle) :');
  [...report.usage.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`   ${String(v).padStart(4)}  ${k}`));
  if (report.linesToCreate.size) console.log(`\nGamme(s) ${isDryRun ? 'à créer' : 'créée(s)'} : ${[...report.linesToCreate].join(', ')}`);
  if (report.modelsToCreate.size) console.log(`Modèle(s) ${isDryRun ? 'à créer' : 'créé(s)'} : ${[...report.modelsToCreate].join(' | ')}`);
  if (report.newMapped.size) {
    console.log('\nSous-catégories rangées avec la table complétée (vérifie que ça te convient) :');
    for (const [k, v] of report.newMapped) console.log(`   ${String(v).padStart(3)}  ${k}`);
  }
  if (report.fallback.size) {
    console.log('\nSous-catégories non prévues -> rangées dans Accessoires > Autres :');
    for (const [k, v] of report.fallback) console.log(`   ${String(v).padStart(3)}  ${k}`);
  }
  if (report.expensive.length) {
    console.log(`\n${report.expensive.length} produit(s) > ${MAX_PRICE} € ignorés (machines ou prix fictifs, à vérifier) :`);
    report.expensive.slice(0, 25).forEach((s) => console.log(`   ${s}`));
  }
  console.log('\n-------------------------------------------------------------');
  console.log(`Produits ${isDryRun ? 'qui seraient créés' : 'créés'} : ${report.created}`);
  console.log(`Doublons ignorés (titre déjà en base) : ${report.duplicates}`);
  if (report.notFetched) console.log(`Pas encore récupérés par l'étape 1 : ${report.notFetched}`);
  if (!isDryRun) {
    console.log(`Sans photo : ${report.noImage}`);
    console.log(`Échecs de récupération d'image : ${report.imageFailures}`);
  }
  console.log('-------------------------------------------------------------\n');
  console.log(isDryRun ? 'Relis le rapport avant de lancer en réel (même commande sans --dry-run).' : 'Import terminé.');
}

main()
  .catch((e) => {
    console.error('Erreur :', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
