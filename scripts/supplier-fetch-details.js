/**
 * ÉTAPE 1/2 — Récupère, page par page et DOUCEMENT, les détails (photo, descriptions, fil d'Ariane
 * de catégories) des produits d'un CSV fournisseur "produits absents de ton site", à partir de la
 * colonne "Lien fournisseur". Rien n'est écrit en base ici : les résultats vont dans un fichier de
 * cache (scripts/cache/supplier-details.json) que lit ensuite scripts/import-supplier-absents.js.
 *
 * Pour ne pas surcharger le site du fournisseur ni être pris pour un robot agressif :
 *  - une seule requête à la fois, avec une pause aléatoire de 1,5 à 3 secondes entre deux pages (--min-delay / --max-delay) ;
 *  - une pause plus longue (15 à 25 s) toutes les 50 pages ;
 *  - par défaut 500 pages maximum par lancement (option --limit) ;
 *  - REPRISE AUTOMATIQUE : une page déjà récupérée n'est jamais redemandée (cache) ;
 *  - ARRÊT IMMÉDIAT dès que le site répond "trop de requêtes", "accès refusé" ou affiche un
 *    contrôle anti-robot — on ne cherche jamais à le contourner : on attend et on relance plus tard.
 *
 * TEST (conseillé en premier) : lit 3 pages, AFFICHE ce qui est extrait, n'écrit rien :
 *   node scripts/supplier-fetch-details.js scripts/produits_fournisseur_absents_de_ton_site_2026-10-04.csv --sample 3
 *
 * LOT RÉEL (500 pages) — à relancer plusieurs fois, à des moments différents :
 *   node scripts/supplier-fetch-details.js scripts/produits_fournisseur_absents_de_ton_site_2026-10-04.csv --limit 500
 *
 * Options : --only Huawei   (une seule catégorie du CSV : Huawei, Samsung, Xiaomi, iPad, "Apple/iPhone", Accessoires)
 *           --limit N       (nombre max de pages ce lancement, défaut 500)
 *           --sample N      (test, n'écrit pas le cache)
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

const csvPath = process.argv[2];
const args = process.argv.slice(3);
function argValue(name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
}
const SAMPLE = argValue('--sample') ? parseInt(argValue('--sample'), 10) : 0;
const LIMIT = argValue('--limit') ? parseInt(argValue('--limit'), 10) : 500;
const ONLY = argValue('--only');

const CACHE_DIR = path.join(__dirname, 'cache');
const CACHE_FILE = path.join(CACHE_DIR, 'supplier-details.json');

// Rythme par défaut : 1,5 à 3 s entre deux pages, pause de 15 à 25 s toutes les 50 pages.
// Modifiable : --min-delay 2 --max-delay 4 (en secondes). Plus c'est rapide, plus le risque d'être bloqué augmente.
const MIN_DELAY_MS = (argValue('--min-delay') ? parseFloat(argValue('--min-delay')) : 1.5) * 1000;
const MAX_DELAY_MS = Math.max(MIN_DELAY_MS + 500, (argValue('--max-delay') ? parseFloat(argValue('--max-delay')) : 3) * 1000);
const LONG_PAUSE_EVERY = 50;
const LONG_PAUSE_MIN_MS = 15000;
const LONG_PAUSE_MAX_MS = 25000;

// User-Agent honnête : on ne se fait pas passer pour un navigateur.
const USER_AGENT = 'ReparMonPhone-catalogue-sync/1.0 (contact@reparmonphone.fr)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (min, max) => Math.floor(min + Math.random() * (max - min));

function readCsv(filePath) {
  const buffer = fs.readFileSync(filePath);
  let content = buffer.toString('utf-8');
  if (content.includes('�')) content = buffer.toString('latin1');
  return parse(content, { delimiter: ';', quote: '"', columns: true, bom: true, relax_column_count: true, skip_empty_lines: true, trim: false });
}

function loadCache() {
  try {
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
  } catch {
    return {};
  }
}
function saveCache(cache) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 1), 'utf-8');
}

// ---------- extraction HTML (sans dépendance : regex prudentes + JSON-LD) ----------

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', euro: '€', rsquo: '’', lsquo: '‘', laquo: '«', raquo: '»', hellip: '…', eacute: 'é', egrave: 'è', agrave: 'à', ecirc: 'ê', ccedil: 'ç' };
function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => (ENTITIES[name.toLowerCase()] !== undefined ? ENTITIES[name.toLowerCase()] : m));
}
function htmlToText(html) {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/\s+/g, ' ')
    .trim();
}

function metaContent(html, attr, name) {
  const re1 = new RegExp(`<meta[^>]+${attr}=["']${name}["'][^>]*content=["']([^"']*)["']`, 'i');
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*${attr}=["']${name}["']`, 'i');
  const m = html.match(re1) || html.match(re2);
  return m ? decodeEntities(m[1]).trim() : '';
}

function jsonLdBlocks(html) {
  const out = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    try {
      const data = JSON.parse(m[1].trim());
      const stack = Array.isArray(data) ? [...data] : [data];
      while (stack.length) {
        const node = stack.shift();
        if (!node || typeof node !== 'object') continue;
        out.push(node);
        if (Array.isArray(node['@graph'])) stack.push(...node['@graph']);
      }
    } catch {
      // bloc JSON-LD invalide : ignoré
    }
  }
  return out;
}
const hasType = (node, type) => [].concat(node['@type'] || []).includes(type);

function extractBreadcrumb(html, ld) {
  // 1) JSON-LD BreadcrumbList
  const bl = ld.find((n) => hasType(n, 'BreadcrumbList'));
  if (bl && Array.isArray(bl.itemListElement)) {
    const names = bl.itemListElement
      .slice()
      .sort((a, b) => (a.position || 0) - (b.position || 0))
      .map((it) => decodeEntities(String((it.name || (it.item && it.item.name) || '')).trim()))
      .filter(Boolean);
    if (names.length) return names;
  }
  // 2) Fil d'Ariane HTML (structure Magento : <div class="breadcrumbs"> … <li class="item …">)
  const block = html.match(/<(?:div|nav|ul)[^>]+class=["'][^"']*breadcrumbs?[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|nav|ul)>/i);
  if (block) {
    const items = [...block[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => htmlToText(m[1])).filter(Boolean);
    if (items.length) return items;
  }
  return [];
}

function extractDetails(html, pageUrl) {
  const ld = jsonLdBlocks(html);
  const product = ld.find((n) => hasType(n, 'Product')) || {};

  let image = '';
  const pi = product.image;
  if (typeof pi === 'string') image = pi;
  else if (Array.isArray(pi) && pi.length) image = typeof pi[0] === 'string' ? pi[0] : pi[0] && pi[0].url ? pi[0].url : '';
  else if (pi && typeof pi === 'object' && pi.url) image = pi.url;
  if (!image) image = metaContent(html, 'property', 'og:image');
  if (image) {
    try {
      image = new URL(image, pageUrl).toString();
    } catch {
      image = '';
    }
  }

  const shortDescription = metaContent(html, 'name', 'description') || metaContent(html, 'property', 'og:description');

  // Description longue : bloc Magento "product attribute description" ; sinon description JSON-LD.
  let longDescription = '';
  const blockStart = html.search(/<div[^>]+class=["'][^"']*product attribute description[^"']*["']/i);
  if (blockStart >= 0) {
    const chunk = html.slice(blockStart, blockStart + 60000);
    const v = chunk.match(/<div[^>]+class=["'][^"']*value[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>/i);
    if (v) longDescription = htmlToText(v[1]);
  }
  if (!longDescription && product.description) longDescription = htmlToText(String(product.description));

  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const title = decodeEntities(String(product.name || (h1 ? htmlToText(h1[1]) : ''))).trim();

  return {
    title,
    image,
    shortDescription,
    longDescription,
    breadcrumb: extractBreadcrumb(html, ld),
  };
}

// Détecte une page de blocage / contrôle anti-robot (on s'arrête, on ne contourne jamais).
function looksBlocked(html) {
  return /captcha|cf-challenge|just a moment|access denied|accès refusé|too many requests|vérification de sécurité|are you a robot|are you human/i.test(html.slice(0, 20000));
}

async function fetchPage(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html', 'Accept-Language': 'fr-FR,fr;q=0.9' },
    redirect: 'follow',
  });
  const text = await res.text();
  return { status: res.status, html: text };
}

async function main() {
  if (!csvPath || !fs.existsSync(csvPath)) {
    console.error('Usage : node scripts/supplier-fetch-details.js chemin/vers/fichier.csv [--sample 3 | --limit 100] [--only Huawei]');
    process.exit(1);
  }

  let rows = readCsv(csvPath).filter((r) => (r['Lien fournisseur'] || '').trim() && (r['Reference_SKU'] || '').trim());
  if (ONLY) rows = rows.filter((r) => (r['Categorie'] || '').trim().toLowerCase() === ONLY.toLowerCase());

  const cache = loadCache();
  const todo = rows.filter((r) => !cache[r['Reference_SKU'].trim()]);
  const done = rows.length - todo.length;

  console.log(`${rows.length} produit(s) dans le CSV${ONLY ? ` (catégorie "${ONLY}")` : ''} — ${done} déjà récupéré(s), ${todo.length} restant(s).`);
  const batchSize = SAMPLE > 0 ? SAMPLE : LIMIT;
  const batch = todo.slice(0, batchSize);
  if (batch.length === 0) {
    console.log('Rien à récupérer.');
    return;
  }
  const estimated = Math.round((batch.length * (MIN_DELAY_MS + MAX_DELAY_MS)) / 2 / 60000);
  console.log(`Ce lancement : ${batch.length} page(s), environ ${estimated} minute(s). Ctrl+C pour arrêter (rien n'est perdu).\n`);

  let fetched = 0;
  for (let i = 0; i < batch.length; i++) {
    const row = batch[i];
    const sku = row['Reference_SKU'].trim();
    const url = row['Lien fournisseur'].trim();
    process.stdout.write(`[${i + 1}/${batch.length}] ${sku} ${(row['Nom'] || '').slice(0, 55)} ... `);

    let result;
    try {
      result = await fetchPage(url);
    } catch (e) {
      console.log(`erreur réseau (${e.message}) — arrêt.`);
      break;
    }

    if ([403, 429, 503].includes(result.status) || (result.status === 200 && looksBlocked(result.html))) {
      console.log(`\n\n⛔ Le site du fournisseur répond HTTP ${result.status} (limite / blocage / contrôle anti-robot).`);
      console.log('   ARRÊT immédiat. Ne relance pas tout de suite : attends plusieurs heures (idéalement le lendemain)');
      console.log('   et relance avec un --limit plus petit. Ce qui a déjà été récupéré est conservé.');
      console.log('   Si cela se reproduit, demande plutôt à ton fournisseur un export complet de ces références.');
      break;
    }

    if (result.status === 404 || result.status === 410) {
      console.log('page introuvable (404).');
      if (SAMPLE === 0) cache[sku] = { sku, url, status: 'notfound', fetchedAt: new Date().toISOString() };
    } else if (result.status !== 200) {
      console.log(`HTTP ${result.status} — ignoré pour cette fois (sera retenté au prochain lancement).`);
    } else {
      const details = extractDetails(result.html, url);
      if (SAMPLE > 0) {
        console.log('OK\n');
        console.log('   titre            :', details.title || '(non trouvé)');
        console.log('   image            :', details.image || '(non trouvée)');
        console.log('   fil d\'Ariane     :', details.breadcrumb.length ? details.breadcrumb.join(' > ') : '(non trouvé)');
        console.log('   desc. courte     :', details.shortDescription ? details.shortDescription.slice(0, 140) : '(non trouvée)');
        console.log(`   desc. longue     : ${details.longDescription.length} caractères — ${details.longDescription.slice(0, 160) || '(non trouvée)'}\n`);
      } else {
        console.log(`OK (${details.breadcrumb.length} niveaux de catégorie, image ${details.image ? 'oui' : 'non'}, desc ${details.longDescription.length} car.)`);
        cache[sku] = { sku, url, status: 'ok', fetchedAt: new Date().toISOString(), ...details };
        fetched++;
        if (fetched % 10 === 0) saveCache(cache);
      }
    }

    if (i < batch.length - 1) {
      const longPause = (i + 1) % LONG_PAUSE_EVERY === 0;
      const wait = longPause ? rand(LONG_PAUSE_MIN_MS, LONG_PAUSE_MAX_MS) : rand(MIN_DELAY_MS, MAX_DELAY_MS);
      if (longPause) console.log(`   (pause de ${Math.round(wait / 1000)} s)`);
      await sleep(wait);
    }
  }

  if (SAMPLE === 0) {
    saveCache(cache);
    const total = Object.keys(cache).length;
    console.log(`\nCache enregistré : ${total} produit(s) au total dans scripts/cache/supplier-details.json.`);
    const left = rows.filter((r) => !cache[r['Reference_SKU'].trim()]).length;
    console.log(left > 0 ? `Il en reste ${left} à récupérer : relance la même commande plus tard.` : 'Tout est récupéré. Tu peux lancer scripts/import-supplier-absents.js.');
  } else {
    console.log('Test terminé : rien n\'a été enregistré. Copie-colle ce résultat pour vérifier que l\'extraction est correcte.');
  }
}

main().catch((e) => {
  console.error('Erreur :', e);
  process.exit(1);
});
