/**
 * Importe les produits Xiaomi d'un export CSV fournisseur (pieces2mobile.com, colonnes : Nom ;
 * Reference_SKU ; Prix_TTC ; Devise ; Disponibilite ; Categorie ; URL_Produit ; URL_Image ;
 * Description_Courte ; Description_Longue) dans le catalogue ReparMonPhone, sous la marque Xiaomi.
 *
 * Pour CHAQUE ligne du CSV :
 *   1. On cherche d'abord si un produit très proche existe déjà sur le site (même méthode de
 *      correspondance de titre que scripts/lib/matchSupplier.js, restreinte aux produits Xiaomi
 *      déjà en base) :
 *        - Trouvé -> on ne crée RIEN, on se contente de rattacher/mettre à jour son SKU fournisseur
 *          (supplierSku/supplierPrice), exactement comme scripts/backfill-supplier-sku.js.
 *        - Pas trouvé -> c'est un vrai nouveau produit, on le crée (voir plus bas).
 *
 * Pour la création d'un nouveau produit, la Gamme/le Modèle (ProductLine/Model) sont déduits de la
 * colonne Categorie ("Xiaomi > Gamme Redmi Note > Redmi Note 12 4G / 5G" ou "Xiaomi > Mi A > Mi A2") :
 *   - On cherche D'ABORD si un Modèle du même nom existe déjà QUELQUE PART sous la marque Xiaomi
 *     (peu importe sa Gamme actuelle) -> si oui, le nouveau produit rejoint ce modèle existant, pour
 *     ne jamais éclater une même gamme de téléphone (ex: "Mi A2 Lite", "Mi A3") entre deux Gammes
 *     différentes.
 *   - Sinon seulement, on crée (ou réutilise) la Gamme donnée par le fournisseur, puis le Modèle.
 *
 * Prix : copié directement du Prix_TTC fournisseur (même logique zéro-marge que tout le reste du
 * catalogue — voir scripts/diagnose-pricing-vs-csv.js). Stock : "En stock" -> inStock=true. Type de
 * pièce (PieceType) : déduit par mots-clés du titre. showInBoutique : true (produits visibles
 * immédiatement — décision de Krys du 12/09/2026).
 *
 * Images : téléchargées depuis URL_Image et réhébergées sur Supabase Storage (comme
 * scripts/import-supplier-products.js) — non bloquant, le produit est quand même créé si l'image
 * échoue.
 *
 * MODE APERÇU (par défaut, RIEN n'est écrit ni téléchargé) :
 *   node scripts/import-xiaomi-products.js chemin/vers/xiaomi.csv
 *
 * MODE RÉEL :
 *   node scripts/import-xiaomi-products.js chemin/vers/xiaomi.csv --apply
 */

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.join(__dirname, '../.env.migration') });
const { normalize, buildSupplierIndex, findBestMatch } = require('./lib/matchSupplier');

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');
const csvPath = process.argv[2];

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || 'products';

// ============================================================
// Parseur CSV robuste : gère les champs entre guillemets contenant des retours à la ligne (les
// descriptions longues du fournisseur en contiennent), ce que csv-parse/sync refuse par défaut.
// ============================================================
function parseCsvRobust(content) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    if (inQuotes) {
      if (c === '"') {
        if (content[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ';') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); field = ''; rows.push(row); row = []; }
    else if (c === '\r') { /* ignoré */ }
    else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function readFileSmartEncoding(filePath) {
  const buffer = fs.readFileSync(filePath);
  const asUtf8 = buffer.toString('utf-8').replace(/^﻿/, '');
  if (asUtf8.includes('�')) return buffer.toString('latin1').replace(/^﻿/, '');
  return asUtf8;
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

// "Redmi note 12 4G / 5G" -> "Redmi Note 12 4G / 5G" : capitalise chaque mot entièrement en
// minuscules (le fournisseur est incohérent sur la casse), laisse intacts les codes/sigles déjà
// en majuscules ou mixtes (4G, BM59, (2025)...).
function fixCasing(s) {
  return s
    .split(' ')
    .map((w) => (/^[a-z]+$/.test(w) ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}

// Déduit Gamme + Modèle depuis la colonne Categorie du fournisseur, ex :
//   "Xiaomi > Gamme Redmi Note > Redmi note 12 4G / 5G"  -> { gamme: "Redmi Note", modele: "Redmi Note 12 4G / 5G" }
//   "Xiaomi > Mi A > Mi A2 Lite"                          -> { gamme: "Mi A", modele: "Mi A2 Lite" }
function parseCategorie(categorie) {
  const parts = categorie.split('>').map((s) => s.trim()).filter(Boolean);
  if (parts.length < 3) return null;
  // Le fournisseur catégorise aussi des accessoires génériques (housses, verre trempé, chargeurs...)
  // sous "Accessoires > ..." même quand le titre mentionne Xiaomi (ils ne sont pas propres à un
  // modèle Xiaomi). On ne veut importer ICI que les vraies pièces détachées par modèle de téléphone,
  // donc on exige que la catégorie commence bien par "Xiaomi >".
  if (parts[0] !== 'Xiaomi') return null;
  const gammeRaw = parts[1].replace(/^Gamme\s+/i, '').trim();
  const modeleRaw = parts[parts.length - 1].trim();
  return { gamme: fixCasing(gammeRaw), modele: fixCasing(modeleRaw) };
}

// Type de pièce déduit du titre par mots-clés (même esprit que PART_TYPE_WORDS de matchSupplier.js).
function guessPieceType(titre) {
  const t = normalize(titre);
  if (/\b(ecran|afficheur|lcd)\b/.test(t)) return 'ECRAN';
  if (/\bbatterie\b/.test(t)) return 'BATTERIE';
  if (/\bcamera\b/.test(t)) return 'CAMERA';
  if (/\b(nappe|connecteur)\b/.test(t)) return 'NAPPE_CONNECTEUR';
  if (/\b(vitre arriere|cache batterie|coque arriere)\b/.test(t)) return 'VITRE_ARRIERE';
  if (/\bchassis\b/.test(t)) return 'CHASSIS';
  if (/\b(haut parleur|parleur|ecouteur)\b/.test(t)) return 'HAUT_PARLEUR';
  if (/\bvibreur\b/.test(t)) return 'VIBREUR';
  if (/\bbouton\b/.test(t)) return 'BOUTON';
  if (/\b(tournevis|pince|ventouse|outillage|outil)\b/.test(t)) return 'OUTILLAGE';
  if (/\b(coque|housse|protection|verre trempe|film|adhesif|stylet)\b/.test(t)) return 'ACCESSOIRE';
  return 'AUTRE';
}

function guessQuality(titre) {
  if (/reconditionn[ée]\s*\(PIEC\)/i.test(titre)) return 'Reconditionné (PIEC)';
  if (/\borigine\b/i.test(titre)) return 'Origine';
  return null;
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
  const filename = `xiaomi/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
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
    console.error('Usage : node scripts/import-xiaomi-products.js chemin/vers/xiaomi.csv [--apply]');
    process.exit(1);
  }
  if (!fs.existsSync(csvPath)) {
    console.error(`Fichier introuvable : ${csvPath}`);
    process.exit(1);
  }

  console.log(APPLY ? '⚠️  MODE REEL — le catalogue va etre modifie.\n' : '🧪 MODE APERCU — rien ne sera ecrit ni telecharge.\n');

  const content = readFileSmartEncoding(csvPath);
  const rawRows = parseCsvRobust(content);
  const headers = rawRows[0];
  const idx = Object.fromEntries(headers.map((h, i) => [h, i]));
  const requiredCols = ['Nom', 'Reference_SKU', 'Prix_TTC', 'Disponibilite', 'Categorie', 'URL_Image'];
  for (const c of requiredCols) {
    if (!(c in idx)) { console.error(`Colonne attendue absente du CSV : ${c}`); process.exit(1); }
  }

  const rows = rawRows.slice(1)
    .filter((r) => r.length >= headers.length && (r[idx['Nom']] || '').trim())
    .map((r) => ({
      nom: (r[idx['Nom']] || '').trim(),
      sku: (r[idx['Reference_SKU']] || '').trim(),
      prix: Number((r[idx['Prix_TTC']] || '0').replace(',', '.')) || 0,
      disponibilite: (r[idx['Disponibilite']] || '').trim(),
      categorie: (r[idx['Categorie']] || '').trim(),
      urlImage: (r[idx['URL_Image']] || '').trim(),
      descriptionCourte: (r[idx['Description_Courte']] || '').trim(),
      descriptionLongue: (r[idx['Description_Longue']] || '').trim().replace(/&nbsp;/g, ' '),
    }))
    .filter((r) => r.nom && r.sku);

  console.log(`${rows.length} ligne(s) valide(s) lues dans ${path.basename(csvPath)}.\n`);

  const brand = await prisma.brand.findFirst({ where: { name: { equals: 'Xiaomi', mode: 'insensitive' } } });
  if (!brand) {
    console.error('❌ Marque "Xiaomi" introuvable en base. Vérifie prisma.brand avant de continuer.');
    process.exit(1);
  }

  // Tous les produits Xiaomi déjà en base, pour la détection de doublon par titre.
  const existingXiaomiProducts = await prisma.product.findMany({
    where: { model: { productLine: { brandId: brand.id } } },
    select: { id: true, title: true, slug: true, supplierSku: true },
  });
  const dedupIndex = buildSupplierIndex(
    existingXiaomiProducts.map((p) => ({ nom: p.title, sku: p.id, prix: 0, disponibilite: '' }))
  );
  const productById = new Map(existingXiaomiProducts.map((p) => [p.id, p]));

  // Toutes les Gammes + Modèles Xiaomi déjà en base, pour réutiliser un modèle existant quel que
  // soit sous quelle Gamme le fournisseur le classe (évite d'éclater "Mi A2 Lite" entre "Mi" et une
  // nouvelle gamme "Mi A", par exemple).
  const existingLines = await prisma.productLine.findMany({
    where: { brandId: brand.id },
    include: { models: true },
  });
  const modelByNormName = new Map(); // nom de modèle normalisé -> { model, line }
  const lineByNormName = new Map(); // nom de gamme normalisé -> line
  for (const line of existingLines) {
    lineByNormName.set(normalize(line.name), line);
    for (const model of line.models) {
      modelByNormName.set(normalize(model.name), { model, line });
    }
  }

  const supabase = APPLY && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    : null;

  let matchedExisting = 0;
  let skuAlreadyUpToDate = 0;
  let skuUpdated = 0;
  let created = 0;
  let linesCreated = 0;
  let modelsCreated = 0;
  let imageFailures = 0;
  let categorieInvalide = 0;
  let priceOutliers = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const label = `[${i + 1}/${rows.length}] ${row.nom.slice(0, 60)}`;

    // 1) Un produit très proche existe-t-il déjà sur le site ?
    const match = findBestMatch(row.nom, dedupIndex);
    if (match) {
      matchedExisting++;
      const existing = productById.get(match.row.sku);
      if (existing.supplierSku === row.sku) {
        skuAlreadyUpToDate++;
      } else {
        skuUpdated++;
        console.log(`${label}\n   -> déjà sur le site ("${existing.title}") — SKU fournisseur ${APPLY ? 'mis à jour' : 'à mettre à jour'}.`);
        if (APPLY) {
          await prisma.product.update({
            where: { id: existing.id },
            data: { supplierSku: row.sku, supplierPrice: row.prix, supplierPriceCheckedAt: new Date() },
          });
        }
      }
      continue;
    }

    // 2) Vraiment nouveau -> à créer.
    const pieceType = guessPieceType(row.nom);

    // Garde-fou anti-erreur de prix fournisseur : repéré sur ce CSV, quelques lignes ont un prix
    // absurde pour le type de pièce (ex: "Vitre cache caméra" à 1200€, alors que la même pièce coûte
    // 1 à 10€ partout ailleurs dans le fichier — probablement une virgule perdue côté fournisseur,
    // "12,00" devenu "1200"). Seuls les écrans peuvent légitimement dépasser 300€ (écrans OLED haut
    // de gamme) — pour tout le reste, un prix > 300€ est mis de côté pour vérification manuelle
    // plutôt qu'importé tel quel sur la boutique, AVANT de créer une éventuelle nouvelle Gamme/Modèle.
    if (row.prix > 300 && pieceType !== 'ECRAN') {
      priceOutliers++;
      console.log(`${label}\n   -> ⚠️ prix suspect (${row.prix.toFixed(2)}€ pour ${pieceType}) — ligne ignorée, à vérifier manuellement.`);
      continue;
    }

    const parsed = parseCategorie(row.categorie);
    if (!parsed) {
      categorieInvalide++;
      console.log(`${label}\n   -> ⚠️ catégorie fournisseur inattendue ("${row.categorie}") — ligne ignorée.`);
      continue;
    }

    // Réutilise un Modèle existant portant ce nom, où qu'il soit rangé.
    let target = modelByNormName.get(normalize(parsed.modele));
    if (!target) {
      // Sinon, trouve/crée la Gamme donnée par le fournisseur, puis crée le Modèle dedans.
      let line = lineByNormName.get(normalize(parsed.gamme));
      if (!line) {
        linesCreated++;
        console.log(`   -> nouvelle Gamme "${parsed.gamme}" (${APPLY ? 'créée' : 'à créer'})`);
        if (APPLY) {
          line = await prisma.productLine.create({
            data: { name: parsed.gamme, slug: slugify(parsed.gamme), brandId: brand.id },
          });
        } else {
          line = { id: `preview-${slugify(parsed.gamme)}`, name: parsed.gamme };
        }
        lineByNormName.set(normalize(parsed.gamme), line);
      }
      modelsCreated++;
      console.log(`   -> nouveau Modèle "${parsed.modele}" sous "${line.name}" (${APPLY ? 'créé' : 'à créer'})`);
      let model;
      if (APPLY) {
        model = await prisma.model.create({
          data: { name: parsed.modele, slug: slugify(parsed.modele), productLineId: line.id },
        });
      } else {
        model = { id: `preview-${slugify(parsed.modele)}`, name: parsed.modele };
      }
      target = { model, line };
      modelByNormName.set(normalize(parsed.modele), target);
    }

    const quality = guessQuality(row.nom);
    const inStock = /en stock/i.test(row.disponibilite);

    created++;
    console.log(`${label}\n   -> NOUVEAU produit sous ${target.line.name} > ${target.model.name} (${pieceType}, ${row.prix.toFixed(2)}€) ${APPLY ? '— créé' : '— à créer'}`);

    if (APPLY) {
      let imageUrl = null;
      if (row.urlImage && supabase) {
        try {
          imageUrl = await downloadAndUploadImage(row.urlImage, supabase);
        } catch (e) {
          imageFailures++;
          console.log(`      image non récupérée (${e.message}) — produit créé sans photo.`);
        }
      }
      const slug = await uniqueProductSlug(row.nom);
      const newProduct = await prisma.product.create({
        data: {
          title: row.nom,
          slug,
          price: row.prix,
          inStock,
          pieceType,
          quality,
          shortDescription: row.descriptionCourte || null,
          description: row.descriptionLongue || null,
          imageUrl,
          images: imageUrl ? [imageUrl] : [],
          showInBoutique: true,
          modelId: target.model.id,
          supplierSku: row.sku,
          supplierPrice: row.prix,
          supplierPriceCheckedAt: new Date(),
        },
      });
      // Ajoute ce produit fraîchement créé à l'index de dédoublonnage pour les lignes suivantes du
      // même CSV (deux lignes très proches ne doivent pas créer deux fois le même produit).
      productById.set(newProduct.id, newProduct);
      dedupIndex.prepared.push(
        (() => {
          const norm = normalize(newProduct.title);
          const tokens = norm ? norm.split(' ').filter(Boolean) : [];
          const blockTokens = tokens.filter((t) => t.length >= 3);
          const keyTokens = new Set(tokens.filter((t) => /[0-9]/.test(t) || ['x','xr','xs','se','max','mini','plus','pro','ultra','fe','lite','air','edge','note'].includes(t)));
          const PART_TYPE_WORDS = new Set(['ecran','vitre','chassis','nappe','connecteur','camera','batterie','haut','parleur','bouton','tiroir','adhesif','verre','coque','protection','stylet','vibreur','antenne','capteur','microphone','prise','cable','chargeur','support','film','afficheur','housse','coussinet','joint','ventouse','outillage','outil','vis','grille']);
          const partTokens = new Set(tokens.filter((t) => PART_TYPE_WORDS.has(t)));
          const idx2 = dedupIndex.prepared.length;
          for (const t of new Set(blockTokens)) {
            if (!dedupIndex.tokenIndex.has(t)) dedupIndex.tokenIndex.set(t, []);
            dedupIndex.tokenIndex.get(t).push(idx2);
          }
          return { nom: newProduct.title, sku: newProduct.id, prix: 0, disponibilite: '', _norm: norm, _blockTokens: blockTokens, _keyTokens: keyTokens, _partTokens: partTokens };
        })()
      );
    }
  }

  console.log('\n--------------------------------');
  console.log(`Produits déjà présents sur le site (correspondance trouvée) : ${matchedExisting}`);
  console.log(`   dont SKU déjà à jour : ${skuAlreadyUpToDate}`);
  console.log(`   dont SKU ${APPLY ? 'mis à jour' : 'à mettre à jour'} : ${skuUpdated}`);
  console.log(`Nouveaux produits ${APPLY ? 'créés' : 'à créer'} : ${created}`);
  console.log(`Nouvelles Gammes ${APPLY ? 'créées' : 'à créer'} : ${linesCreated}`);
  console.log(`Nouveaux Modèles ${APPLY ? 'créés' : 'à créer'} : ${modelsCreated}`);
  if (APPLY) console.log(`Échecs de récupération d'image : ${imageFailures}`);
  if (categorieInvalide > 0) console.log(`Lignes ignorées (catégorie fournisseur inattendue) : ${categorieInvalide}`);
  if (priceOutliers > 0) console.log(`Lignes ignorées (prix suspect > 300€, à vérifier manuellement) : ${priceOutliers}`);
  console.log('--------------------------------\n');

  if (!APPLY) {
    console.log('Aperçu uniquement — relance avec --apply pour écrire réellement en base et télécharger les images.');
  } else {
    console.log('Import terminé.');
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
