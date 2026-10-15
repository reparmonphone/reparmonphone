/**
 * ÉTAPE 2/2 — Importe dans le catalogue ReparMonPhone les produits d'un CSV "produits fournisseur
 * absents de ton site" (6 colonnes : Nom, Reference_SKU, Prix_TTC, Disponibilite, Categorie,
 * Lien fournisseur), en complétant chaque produit avec les détails récupérés par
 * scripts/supplier-fetch-details.js (photo, descriptions, fil d'Ariane de catégories).
 *
 * Principes (les mêmes que tes scripts d'import précédents) :
 *  - Marque / gamme / modèle sont DÉDUITS du fil d'Ariane de la page fournisseur (ex: "Huawei > Gamme P > P30 Lite").
 *  - Un produit est rattaché à un modèle EXISTANT (nom exact, puis normalisé, puis sans références
 *    entre parenthèses). Jamais assigné au hasard : si plusieurs modèles correspondent, il est ignoré et listé.
 *  - Modèle manquant -> CRÉÉ (sans photo) sous la gamme existante. Gamme manquante -> créée, sauf pour Apple et
 *    Accessoires (listés dans le rapport, rien n'est créé). Samsung : les références entre parenthèses
 *    sont retirées du nom du modèle (comme create-missing-samsung-categories.js).
 *  - Textes nettoyés dès l'import : "Pieces2mobile" -> ReparMonPhone ; "Envois gratuits dès 35 euros." ->
 *    "Livraison gratuite dès 250€ d'achat en France métropolitaine." ; "Comptes professionnels." retiré ;
 *    "Leader en vente de pièces détachées…" -> "Spécialiste français des pièces détachées pour smartphones et tablettes".
 *  - Photo : téléchargée et réhébergée sur Supabase (avec une pause entre chaque téléchargement). L'image générique
 *    "photo-generique / placeholder" du fournisseur est IGNORÉE (produit créé sans photo).
 *  - Type de pièce déduit du titre (écran, batterie, nappe/connecteur, caméra, châssis…) pour que les produits
 *    apparaissent dans les pages « Écrans / Batteries / … » du site.
 *  - Doublon (titre déjà en base) ignoré. Produit pas encore récupéré par l'étape 1 : ignoré (relance plus tard).
 *
 * MODE DRY-RUN (à faire en premier, relis bien le rapport) :
 *   node scripts/import-supplier-absents.js scripts/produits_fournisseur_absents_de_ton_site_2026-10-04.csv --dry-run --only Huawei
 *
 * MODE RÉEL :
 *   node scripts/import-supplier-absents.js scripts/produits_fournisseur_absents_de_ton_site_2026-10-04.csv --only Huawei
 *
 * Options : --only <catégorie du CSV>  (Huawei, Samsung, Xiaomi, iPad, "Apple/iPhone", Accessoires) — conseillé :
 *                                       une catégorie à la fois
 *           --limit N                  (crée au plus N produits ce lancement)
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
const ONLY = argValue('--only');
// --allow-new-line iPod  : autorise la création de cette gamme Apple (sinon aucune gamme Apple n'est jamais créée).
const ALLOWED_NEW_LINES = (argValue('--allow-new-line') || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
const LIMIT = argValue('--limit') ? parseInt(argValue('--limit'), 10) : Infinity;

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

// ---------------- type de pièce (même logique que import-xiaomi-products.js) ----------------

function guessPieceType(titre) {
  const t = titre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // Outils de réparation / test (avant les pièces : "Nappe de test iPhone" n'est PAS une nappe de pièce).
  if (/(nappe (de )?test|testeur|rebillage|reprogrammation|station|soudure|fer a souder|tournevis|\bpince\b|ventouse|outillage|\boutil\b)/.test(t)) return 'OUTILLAGE';
  if (/\b(vitre arriere|cache batterie|coque arriere)\b/.test(t)) return 'VITRE_ARRIERE';
  if (/(protection|verre\s*tremp|\bfilm\b|housse|\bcoque|adhesif|stylet)/.test(t)) return 'ACCESSOIRE';
  if (/\b(ecran|afficheur|lcd)\b/.test(t)) return 'ECRAN';
  if (/\bbatterie\b/.test(t)) return 'BATTERIE';
  if (/\bcamera\b/.test(t)) return 'CAMERA';
  if (/\b(nappe|connecteur)\b/.test(t)) return 'NAPPE_CONNECTEUR';
  if (/\bchassis\b/.test(t)) return 'CHASSIS';
  if (/\b(haut parleur|haut-parleur|parleur|ecouteur)\b/.test(t)) return 'HAUT_PARLEUR';
  if (/\bvibreur\b/.test(t)) return 'VIBREUR';
  if (/\bbouton\b/.test(t)) return 'BOUTON';
  return 'AUTRE';
}

// ---------------- fil d'Ariane -> marque / gamme / modèle ----------------

function categoryPath(entry, nom) {
  let parts = (entry.breadcrumb || []).map((p) => p.trim()).filter(Boolean);
  if (parts.length && /^(accueil|home)$/i.test(parts[0])) parts = parts.slice(1);
  // Le dernier niveau est parfois le titre du produit (complet ou approchant) : on le retire.
  const last = parts[parts.length - 1];
  if (last && (norm(last) === norm(nom) || norm(last) === norm(entry.title || ''))) {
    parts = parts.slice(0, -1);
  }
  if (parts.length === 0) return null;
  // Fil d'Ariane trop court (marque > gamme seulement) : le modèle sera déduit du titre du produit.
  if (parts.length < 3) return { brandRaw: parts[0], gamme: (parts[1] || '').replace(/^Gamme\s+/i, '').trim(), modele: null };
  return { brandRaw: parts[0], gamme: parts[1].replace(/^Gamme\s+/i, '').trim(), modele: parts[2] };
}

// ---------------- déduction du modèle depuis le titre (fil d'Ariane incomplet) ----------------

function titleTokens(s) {
  return s
    .replace(/\+/g, ' plus ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}
// Mots qui prolongent un nom de modèle ("S25" -> "S25 Ultra") : si le titre continue par l'un d'eux
// alors que le modèle trouvé s'arrête avant, on refuse le rapprochement (ce serait un autre modèle).
const MODEL_QUALIFIER = /^(ultra|plus|pro|fe|lite|max|mini|edge|neo|5g|4g|prime|core|ace|duos|active|\d+)$/;

function inferModelFromTitle(brand, title) {
  // Retire les parenthèses de référence "(S938B)" puis cherche, parmi TOUS les modèles de la marque,
  // celui dont le nom (sans parenthèses) apparaît tel quel dans le titre. Le plus long l'emporte.
  // 1) Référence constructeur (S931B, A725F, N8000…) présente dans le titre ET dans le nom d'un modèle : très fiable.
  const codes = titleTokens(title).filter((t) => /^[a-z]\d{3,5}[a-z]?$/.test(t));
  for (const code of codes) {
    const hits = [];
    for (const l of brand.lines) for (const m of l.models) if (titleTokens(m.name).includes(code)) hits.push({ m, l });
    if (hits.length === 1) return { found: hits[0] };
  }
  // 2) Sinon le nom du modèle (sans parenthèses) apparaît tel quel dans le titre.
  const tt = titleTokens(stripParenthetical(title));
  let best = [];
  let bestLen = 0;
  for (const l of brand.lines) {
    for (const m of l.models) {
      const mt = titleTokens(stripParenthetical(m.name));
      if (mt.length < 2 && !(mt.length === 1 && /^[a-z]+\d+[a-z]*$/.test(mt[0]))) continue; // trop court = trop risqué ("Ultra", "S")
      for (let i = 0; i + mt.length <= tt.length; i++) {
        if (!mt.every((tok, k) => tt[i + k] === tok)) continue;
        const next = tt[i + mt.length];
        if (next && MODEL_QUALIFIER.test(next)) continue; // le titre parle d'un autre modèle plus long
        if (mt.length > bestLen) { best = [{ m, l }]; bestLen = mt.length; }
        else if (mt.length === bestLen && !best.some((b) => b.m.id === m.id && b.m.name === m.name)) best.push({ m, l });
        break;
      }
    }
  }
  if (best.length === 1) return { found: best[0] };
  if (best.length > 1) return { ambiguous: true };
  return {};
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
    console.error('Usage : node scripts/import-supplier-absents.js chemin/vers/fichier.csv [--dry-run] [--only Huawei] [--limit N]');
    process.exit(1);
  }
  if (!fs.existsSync(CACHE_FILE)) {
    console.error('Cache introuvable (scripts/cache/supplier-details.json). Lance d\'abord scripts/supplier-fetch-details.js.');
    process.exit(1);
  }
  console.log('Version du script : v5 (gammes "Gamme X" reconnues, Honor -> Huawei, --allow-new-line)');
  console.log(isDryRun ? 'MODE DRY-RUN — aucune écriture, aucune image téléchargée.\n' : 'MODE RÉEL — le catalogue va être modifié.\n');

  const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
  let rows = readCsv(csvPath);
  if (ONLY) rows = rows.filter((r) => (r['Categorie'] || '').trim().toLowerCase() === ONLY.toLowerCase());
  console.log(`${rows.length} produit(s) dans le CSV${ONLY ? ` (catégorie "${ONLY}")` : ''}.`);

  const brands = await prisma.brand.findMany({
    include: { lines: { include: { models: true } } },
  });
  const existingTitles = new Set((await prisma.product.findMany({ select: { title: true } })).map((p) => norm(p.title)));

  const brandFor = (raw) => brands.find((b) => norm(b.name) === norm(raw) || norm(b.slug) === norm(raw));

  // Lignes candidates pour une gamme du fil d'Ariane. Apple "IPad" -> toutes les gammes dont le nom contient "ipad".
  function candidateLines(brand, gamme) {
    // Tes gammes Huawei s'appellent "Gamme P", "Gamme Mate"… alors que le fournisseur écrit "P", "Mate" :
    // on compare sans le mot "Gamme" des deux côtés.
    const noG = (x) => norm(x).replace(/^gamme/, '');
    const g = noG(gamme);
    if (norm(brand.name) === 'apple' && g === 'ipad') return brand.lines.filter((l) => norm(l.name).includes('ipad'));
    return brand.lines.filter((l) => noG(l.name) === g);
  }
  function resolveModel(lines, modele) {
    const pool = lines.flatMap((l) => l.models.map((m) => ({ m, l })));
    const exact = pool.filter((x) => x.m.name === modele);
    if (exact.length === 1) return { found: exact[0] };
    const n = norm(modele);
    const normalized = pool.filter((x) => norm(x.m.name) === n);
    if (normalized.length === 1) return { found: normalized[0] };
    if (normalized.length > 1) return { ambiguous: true };
    const s = norm(stripParenthetical(modele));
    const stripped = pool.filter((x) => norm(stripParenthetical(x.m.name)) === s);
    if (stripped.length === 1) return { found: stripped[0] };
    if (stripped.length > 1) return { ambiguous: true };
    const lk = looseKey(modele);
    const loose = lk.length >= 4 ? pool.filter((x) => looseKey(x.m.name) === lk) : [];
    if (loose.length === 1) return { found: loose[0] };
    return {};
  }

  const supabase = !isDryRun && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) : null;

  const report = {
    notFetched: 0,
    notFoundPage: 0,
    noCategory: [],
    tools: [],
    inferred: [],
    manual: [],
    elsewhere: [],
    brandUnknown: new Map(),
    ambiguous: new Map(),
    cannotCreate: new Map(),
    duplicates: 0,
    suspiciousPrice: [],
    linesToCreate: new Map(),
    modelsToCreate: new Map(),
    toCreate: 0,
    created: 0,
    imageFailures: 0,
    noImage: 0,
  };
  const addCount = (map, key, extra = {}) => {
    const e = map.get(key) || { count: 0, ...extra };
    e.count++;
    map.set(key, e);
  };

  for (let i = 0; i < rows.length; i++) {
    if (report.toCreate >= LIMIT) {
      console.log(`\nLimite de ${LIMIT} produit(s) atteinte pour ce lancement.`);
      break;
    }
    const row = rows[i];
    const sku = (row['Reference_SKU'] || '').trim();
    const nom = (row['Nom'] || '').trim();
    if (!nom || !sku) continue;

    const entry = cache[sku];
    if (!entry) {
      report.notFetched++;
      continue;
    }
    if (entry.status !== 'ok') {
      report.notFoundPage++;
      continue;
    }

    const cat = categoryPath(entry, nom);
    if (!cat) {
      report.noCategory.push(nom);
      continue;
    }
    // Outils (testeurs, colles, tournevis…) : pas de création automatique ici — ils passent par
    // scripts/import-supplier-products.js (table CATEGORY_MAP). On les liste seulement.
    if (/^outils?$/i.test(cat.brandRaw)) {
      report.tools.push(nom);
      continue;
    }
    // Honor : pas de marque propre chez nous -> rangé sous Huawei, gamme "Honor" (fil d'Ariane fournisseur : Honor > modèle).
    if (/^honor$/i.test(cat.brandRaw)) {
      const honorModel = cat.modele !== null ? cat.modele : cat.gamme;
      if (!honorModel) { report.noCategory.push(nom); continue; }
      cat.brandRaw = 'Huawei';
      cat.modele = honorModel;
      cat.gamme = 'Honor';
    }
    const brand = brandFor(cat.brandRaw);
    if (!brand) {
      addCount(report.brandUnknown, cat.brandRaw, { sample: nom });
      continue;
    }
    const brandIsApple = norm(brand.name) === 'apple';
    const brandIsAccessoires = norm(brand.name) === 'accessoires';
    const canCreateLine = (!brandIsApple || ALLOWED_NEW_LINES.includes(cat.gamme.toLowerCase())) && !brandIsAccessoires;
    const canCreateModel = !brandIsAccessoires;

    // --- gamme / modèle ---
    let line = null;
    let model = null;
    let modelToCreateName = null;

    if (cat.modele === null) {
      // Fil d'Ariane incomplet : on déduit le modèle depuis le titre, parmi les modèles EXISTANTS uniquement.
      const inf = inferModelFromTitle(brand, nom);
      if (inf.found) {
        model = inf.found.m;
        line = inf.found.l;
        report.inferred.push(`${nom.slice(0, 60)} -> ${brand.name} > ${line.name} > ${model.name}`);
      } else {
        report.manual.push(`${nom.slice(0, 70)}${inf.ambiguous ? ' (plusieurs modèles possibles)' : ''}`);
        continue;
      }
    } else {
      let lines = candidateLines(brand, cat.gamme);
      let resolved = lines.length ? resolveModel(lines, cat.modele) : {};

      // Pas trouvé dans la gamme annoncée : on cherche un modèle UNIQUE du même nom ailleurs dans la marque
      // (ex: modèle déjà créé auparavant sous une autre gamme). Sinon on passe à la création.
      if (!resolved.found && !resolved.ambiguous) {
        const everywhere = resolveModel(brand.lines, cat.modele);
        if (everywhere.found) {
          resolved = everywhere;
          report.elsewhere.push(`${brand.name} > ${cat.gamme} > ${cat.modele}  =>  déjà en base sous "${everywhere.found.l.name} > ${everywhere.found.m.name}"`);
        }
      }

      if (resolved.ambiguous) {
        addCount(report.ambiguous, `${brand.name} > ${cat.gamme} > ${cat.modele}`, { sample: nom });
        continue;
      }
      if (resolved.found) {
        model = resolved.found.m;
        line = resolved.found.l;
      } else {
        if (lines.length === 0) {
          if (!canCreateLine) {
            addCount(report.cannotCreate, `${brand.name} > ${cat.gamme} (gamme absente)`, { sample: nom });
            continue;
          }
          const usesGammePrefix = brand.lines.length > 0 && brand.lines.filter((l) => /^gamme\s/i.test(l.name)).length * 2 >= brand.lines.length;
          const lineName = usesGammePrefix ? `Gamme ${cat.gamme}` : cat.gamme;
          addCount(report.linesToCreate, `${brand.name} > ${lineName}`, {});
          if (isDryRun) {
            line = { id: null, name: lineName, models: [], _planned: true };
            brand.lines.push(line);
          } else {
            line = await prisma.productLine.create({ data: { name: lineName, slug: slugify(lineName), brandId: brand.id } });
            line.models = [];
            brand.lines.push(line);
          }
          lines = [line];
        }
        // Modèle manquant : création sous l'unique gamme candidate.
        if (!canCreateModel || lines.length !== 1) {
          addCount(report.cannotCreate, `${brand.name} > ${cat.gamme} > ${cat.modele} (${!canCreateModel ? 'création interdite' : 'plusieurs gammes possibles'})`, { sample: nom });
          continue;
        }
        line = lines[0];
        modelToCreateName = norm(brand.name) === 'samsung' ? samsungCreateName(cat.modele) : cat.modele;
        const key = `${brand.name} > ${line.name} > ${modelToCreateName}`;
        if (!report.modelsToCreate.has(key)) {
          // Pour t'aider à repérer un faux "nouveau" modèle : modèles existants au nom voisin dans la marque.
          const core = (x) => norm(stripParenthetical(x)).replace(/(5g|4g)$/, '');
          const c = core(modelToCreateName);
          const similar = brand.lines
            .flatMap((l) => l.models.map((m) => ({ m, l })))
            .filter((x) => !x.m._planned && c.length >= 4 && (core(x.m.name) === c || core(x.m.name).startsWith(c) || c.startsWith(core(x.m.name))))
            .slice(0, 3)
            .map((x) => `${x.l.name} > ${x.m.name}`);
          report.modelsToCreate.set(key, { count: 0, similar });
        }
        report.modelsToCreate.get(key).count++;
        if (isDryRun) {
          // Un seul "modèle planifié" par nom, réutilisé par les produits suivants.
          let planned = line.models.find((m) => m._planned && m.name === modelToCreateName);
          if (!planned) {
            planned = { id: null, name: modelToCreateName, _planned: true };
            line.models.push(planned);
          }
          model = planned;
        } else {
          let slug = slugify(modelToCreateName) || 'modele';
          let n = 1;
          while (line.models.some((m) => m.slug === slug)) {
            n++;
            slug = `${slugify(modelToCreateName)}-${n}`;
          }
          model = await prisma.model.create({ data: { name: modelToCreateName, slug, productLineId: line.id } });
          line.models.push(model);
        }
      }
    }

    // --- doublon, prix, type ---
    if (existingTitles.has(norm(nom))) {
      report.duplicates++;
      continue;
    }
    const price = Number(String(row['Prix_TTC'] || '0').replace(',', '.')) || 0;
    let pieceType = guessPieceType(nom);
    if (pieceType === 'AUTRE' && brandIsAccessoires) pieceType = 'ACCESSOIRE';
    if (price > 300 && pieceType !== 'ECRAN' && pieceType !== 'CHASSIS') {
      report.suspiciousPrice.push(`${nom} (${price.toFixed(2)} €)`);
      continue;
    }

    report.toCreate++;
    existingTitles.add(norm(nom));
    if (isDryRun) continue;

    // --- création réelle ---
    const inStock = (row['Disponibilite'] || '').trim() === 'En stock';
    const longDesc = cleanText(entry.longDescription) || null;
    const shortDesc = cleanText(entry.shortDescription) || (longDesc ? longDesc.slice(0, 160) : null);

    let imageUrl = null;
    const src = (entry.image || '').trim();
    if (!src || /placeholder|photo-generique/i.test(src)) {
      report.noImage++;
    } else if (supabase && !imagesDisabled) {
      try {
        imageUrl = await downloadAndUploadImage(src, supabase, slugify(brand.name) || 'import');
      } catch (e) {
        report.imageFailures++;
        console.log(`   image non récupérée pour "${nom.slice(0, 50)}" (${e.message})`);
        if (imagesDisabled) console.log('   ⛔ Le fournisseur refuse les images (403/429) : téléchargements d\'images arrêtés pour ce lancement.');
      }
    } else {
      report.noImage++;
    }

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
        pieceType,
        modelId: model.id,
        showInBoutique: true,
      },
    });
    report.created++;
    if (report.created % 25 === 0) console.log(`... ${report.created} produit(s) créé(s)`);
  }

  // ---------------- rapport ----------------
  console.log('\n================ RAPPORT ================\n');
  if (report.linesToCreate.size) {
    console.log(`🆕 ${report.linesToCreate.size} gamme(s) ${isDryRun ? 'à créer' : 'créée(s)'} :`);
    for (const [k, v] of report.linesToCreate) console.log(`   ${k} (${v.count} produit(s))`);
    console.log('');
  }
  if (report.modelsToCreate.size) {
    console.log(`🆕 ${report.modelsToCreate.size} modèle(s) ${isDryRun ? 'à créer' : 'créé(s)'} (sans photo) :`);
    for (const [k, v] of report.modelsToCreate) {
      console.log(`   ${k}`);
      if (v.similar && v.similar.length) console.log(`        ⚠️ ressemble à un modèle déjà en base : ${v.similar.join(' | ')}`);
    }
    console.log('');
  }
  if (report.elsewhere.length) {
    const uniq = [...new Set(report.elsewhere)];
    console.log(`🔀 ${uniq.length} modèle(s) déjà en base mais sous une autre gamme (produits rattachés à l'existant, rien de créé) :`);
    uniq.forEach((x) => console.log(`   ${x}`));
    console.log('');
  }
  if (report.inferred.length) {
    console.log(`🔎 ${report.inferred.length} produit(s) au fil d'Ariane incomplet, modèle déduit du titre (vérifie un échantillon) :`);
    report.inferred.slice(0, 40).forEach((x) => console.log(`   ${x}`));
    if (report.inferred.length > 40) console.log(`   ... et ${report.inferred.length - 40} autre(s)`);
    console.log('');
  }
  if (report.manual.length) {
    console.log(`✋ ${report.manual.length} produit(s) au fil d'Ariane incomplet dont le modèle n'a pas été trouvé en base — ignorés, à traiter à la main :`);
    report.manual.slice(0, 40).forEach((x) => console.log(`   ${x}`));
    if (report.manual.length > 40) console.log(`   ... et ${report.manual.length - 40} autre(s)`);
    console.log('');
  }
  if (report.tools.length) {
    console.log(`🔧 ${report.tools.length} outil(s) (testeurs, colles…) ignorés ici — à importer via scripts/import-supplier-products.js :`);
    report.tools.slice(0, 10).forEach((x) => console.log(`   ${x.slice(0, 80)}`));
    console.log('');
  }
  if (report.ambiguous.size) {
    console.log(`🟠 ${report.ambiguous.size} modèle(s) AMBIGU(S) (plusieurs correspondances) — ignorés :`);
    for (const [k, v] of report.ambiguous) console.log(`   ${k} (${v.count}, ex: "${v.sample.slice(0, 50)}")`);
    console.log('');
  }
  if (report.cannotCreate.size) {
    console.log(`❌ ${report.cannotCreate.size} cas où rien n'est créé automatiquement (à traiter à la main) :`);
    for (const [k, v] of report.cannotCreate) console.log(`   ${k} (${v.count}, ex: "${v.sample.slice(0, 50)}")`);
    console.log('');
  }
  if (report.brandUnknown.size) {
    console.log(`❌ Marque(s) inconnue(s) en base :`);
    for (const [k, v] of report.brandUnknown) console.log(`   "${k}" (${v.count}, ex: "${v.sample.slice(0, 50)}")`);
    console.log('');
  }
  if (report.noCategory.length) {
    console.log(`❌ ${report.noCategory.length} produit(s) sans catégorie exploitable sur la page fournisseur (ex: ${report.noCategory.slice(0, 3).map((n) => `"${n.slice(0, 40)}"`).join(', ')}) — ignorés.\n`);
  }
  if (report.suspiciousPrice.length) {
    console.log(`⚠️  ${report.suspiciousPrice.length} prix suspect(s) (> 300 € hors écran/châssis) — ignorés, à vérifier :`);
    report.suspiciousPrice.slice(0, 15).forEach((s) => console.log(`   ${s}`));
    console.log('');
  }
  console.log('-------------------------------------------------------------');
  console.log(`Produits ${isDryRun ? 'qui seraient créés' : 'créés'} : ${isDryRun ? report.toCreate : report.created}`);
  console.log(`Doublons ignorés (titre déjà en base) : ${report.duplicates}`);
  console.log(`Pas encore récupérés par l'étape 1 (ignorés pour l'instant) : ${report.notFetched}`);
  console.log(`Page fournisseur introuvable (404) : ${report.notFoundPage}`);
  if (!isDryRun) {
    console.log(`Sans photo (image absente ou générique) : ${report.noImage}`);
    console.log(`Échecs de récupération d'image : ${report.imageFailures}`);
  }
  console.log('-------------------------------------------------------------\n');
  console.log(isDryRun ? 'Relis les sections 🆕 🟠 ❌ avant de lancer en réel (même commande sans --dry-run).' : 'Import terminé.');
}

main()
  .catch((e) => {
    console.error('Erreur :', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
