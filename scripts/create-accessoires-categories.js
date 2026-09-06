/**
 * Crée le squelette de catégories "Accessoires" dans le catalogue (marque + gammes + sous-gammes),
 * à partir du CSV fournisseur scripts/Accessoires_Produits.csv, AVANT tout import de produit.
 *
 * Le site n'a pas de système de catégories séparé : la même hiérarchie Marque > Gamme > Modèle que
 * pour les pièces téléphone est réutilisée ici. Ce script crée donc :
 *   1) une marque "Accessoires" (elle apparaîtra dans le menu du site, juste avant "Outils" — qui
 *      est en réalité une marque nommée "Autre" affichée sous ce nom, voir displayName() dans
 *      src/components/Header.tsx — car le menu trie par ordre alphabétique du nom réel : "Accessoires"
 *      < "Autre", donc elle se place naturellement juste avant sans toucher au code) ;
 *   2) une gamme (ProductLine) par sous-catégorie de niveau 2 du CSV (Audio, Autonomie, Connectique,
 *      GoPro, Protection, Protection Écran, Rock Space, USAMS, Autres, Samsung, Smart Watch) ;
 *   3) un modèle (Model) par sous-catégorie de niveau 3 (ex: Protection > Coques, Protection > Housses
 *      et Étuis). Quand une gamme n'a QUE des lignes sans sous-catégorie de niveau 3 (Connectique,
 *      GoPro, Samsung, Smart Watch), un seul modèle portant le même nom que la gamme est créé, pour
 *      éviter un "Autres > Autres" bizarre. Quand une gamme a un mélange (ex: Protection, Autres), les
 *      lignes sans sous-catégorie sont regroupées dans un modèle "Autres".
 *
 * Ce script NE CRÉE AUCUN PRODUIT — uniquement le squelette (marque/gammes/modèles), sans image
 * (imageUrl laissé vide : Krys les ajoutera depuis /admin/gammes, où l'ordre d'affichage — sortOrder,
 * initialisé ici du plus gros au plus petit nombre de produits — est aussi modifiable par glisser-
 * déposer). Une fois ce squelette en place, un script d'import séparé (sur le même principe que
 * scripts/import-ipad-products.js) pourra rattacher les 1415 produits "Accessoires" du CSV aux bons
 * modèles.
 *
 * Idempotent : peut être relancé sans risque, il ne recrée jamais ce qui existe déjà (comparaison par
 * slug).
 *
 * MODE APERÇU (par défaut, aucune écriture) :
 *   node scripts/create-accessoires-categories.js scripts/Accessoires_Produits.csv
 *
 * MODE RÉEL :
 *   node scripts/create-accessoires-categories.js scripts/Accessoires_Produits.csv --apply
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: path.join(__dirname, '../.env.migration') });

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');
const csvPath = process.argv[2];

const BRAND_NAME = 'Accessoires';

function slugify(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

function readCsv(filePath) {
  let buf = fs.readFileSync(filePath);
  // Même détection qu'ailleurs dans le projet : certains exports fournisseur sont en Latin-1 plutôt
  // qu'en UTF-8 — un caractère de remplacement "�" en UTF-8 trahit un mauvais décodage.
  let text = buf.toString('utf8');
  if (text.includes('�')) {
    text = buf.toString('latin1');
  }
  return parse(text, {
    delimiter: ';',
    quote: '"',
    columns: true,
    bom: true,
    relax_column_count: true,
    skip_empty_lines: true,
    trim: false,
  });
}

async function main() {
  if (!csvPath) {
    console.error('Usage : node scripts/create-accessoires-categories.js scripts/Accessoires_Produits.csv [--apply]');
    process.exit(1);
  }

  console.log(APPLY ? 'MODE REEL - la base va etre modifiee.\n' : 'MODE APERCU - aucune ecriture ne sera faite.\n');

  const rows = readCsv(csvPath).filter((r) => (r.Categorie_Niveau1 || '').trim() === 'Accessoires');
  console.log(`${rows.length} ligne(s) "Accessoires" trouvée(s) dans le CSV.\n`);

  // Regroupe par (niveau2, niveau3) avec un compteur, pour décider de l'ordre d'affichage (du plus
  // gros au plus petit) et repérer les gammes qui n'ont aucune sous-catégorie nommée.
  const lineMap = new Map(); // niveau2 -> { count, subs: Map<niveau3 (jamais ''), count> , emptyCount }
  for (const row of rows) {
    const l2 = (row.Categorie_Niveau2 || '').trim() || 'Autres';
    const l3 = (row.Categorie_Niveau3 || '').trim();
    if (!lineMap.has(l2)) lineMap.set(l2, { count: 0, subs: new Map(), emptyCount: 0 });
    const entry = lineMap.get(l2);
    entry.count++;
    if (l3) {
      entry.subs.set(l3, (entry.subs.get(l3) || 0) + 1);
    } else {
      entry.emptyCount++;
    }
  }

  // Une gamme avec trop peu de produits (ex: "Samsung", "Smart Watch" — 1 produit chacune) ne mérite
  // pas sa propre entrée de menu (confirmé avec Krys) : elle est repliée dans "Autres", sous forme de
  // modèle portant son nom d'origine (donc "Accessoires > Autres > Samsung" au lieu d'une gamme à part).
  const MIN_LINE_COUNT = 3;
  if (!lineMap.has('Autres')) lineMap.set('Autres', { count: 0, subs: new Map(), emptyCount: 0 });
  const autresEntry = lineMap.get('Autres');
  for (const [lineName, entry] of [...lineMap.entries()]) {
    if (lineName === 'Autres' || entry.count >= MIN_LINE_COUNT) continue;
    autresEntry.subs.set(lineName, entry.count);
    autresEntry.count += entry.count;
    lineMap.delete(lineName);
  }

  // Gammes triées de la plus grosse à la plus petite (juste un ordre de départ pratique — modifiable
  // ensuite par glisser-déposer dans /admin/gammes).
  const sortedLines = [...lineMap.entries()].sort((a, b) => b[1].count - a[1].count);

  console.log('--- Aperçu du squelette qui sera créé ---\n');
  for (const [lineName, entry] of sortedLines) {
    console.log(`"${BRAND_NAME}" > "${lineName}" (${entry.count} produit(s) au total dans le CSV)`);
    const subsSorted = [...entry.subs.entries()].sort((a, b) => b[1] - a[1]);
    for (const [subName, subCount] of subsSorted) {
      console.log(`   - Modèle "${subName}" (${subCount})`);
    }
    if (entry.emptyCount > 0) {
      if (subsSorted.length > 0) {
        console.log(`   - Modèle "Autres" (${entry.emptyCount}, lignes sans sous-catégorie précisée)`);
      } else {
        console.log(`   - Modèle "${lineName}" (${entry.emptyCount}, aucune sous-catégorie dans le CSV pour cette gamme)`);
      }
    }
    console.log('');
  }

  if (!APPLY) {
    console.log('Aperçu uniquement — relance avec --apply pour créer réellement ce squelette.');
    await prisma.$disconnect();
    return;
  }

  // --- Création réelle, idempotente ---
  let brand = await prisma.brand.findFirst({ where: { name: BRAND_NAME } });
  if (!brand) {
    brand = await prisma.brand.create({ data: { name: BRAND_NAME, slug: slugify(BRAND_NAME) } });
    console.log(`✅ Marque créée : "${brand.name}" (slug: ${brand.slug})`);
  } else {
    console.log(`ℹ️  Marque "${BRAND_NAME}" déjà existante (id: ${brand.id}) — réutilisée.`);
  }

  let lineSortOrder = 0;
  for (const [lineName, entry] of sortedLines) {
    const lineSlug = slugify(lineName);
    let line = await prisma.productLine.findFirst({ where: { brandId: brand.id, slug: lineSlug } });
    if (!line) {
      line = await prisma.productLine.create({
        data: { name: lineName, slug: lineSlug, brandId: brand.id, sortOrder: lineSortOrder },
      });
      console.log(`  ✅ Gamme créée : "${line.name}"`);
    } else {
      console.log(`  ℹ️  Gamme "${lineName}" déjà existante — réutilisée.`);
    }
    lineSortOrder++;

    const subsSorted = [...entry.subs.entries()].sort((a, b) => b[1] - a[1]);
    let modelSortOrder = 0;

    async function ensureModel(modelName) {
      const modelSlug = slugify(modelName);
      const existing = await prisma.model.findFirst({ where: { productLineId: line.id, slug: modelSlug } });
      if (existing) {
        console.log(`     ℹ️  Modèle "${modelName}" déjà existant — réutilisé.`);
        return;
      }
      await prisma.model.create({
        data: { name: modelName, slug: modelSlug, productLineId: line.id, sortOrder: modelSortOrder },
      });
      console.log(`     ✅ Modèle créé : "${modelName}"`);
    }

    for (const [subName] of subsSorted) {
      await ensureModel(subName);
      modelSortOrder++;
    }
    if (entry.emptyCount > 0) {
      await ensureModel(subsSorted.length > 0 ? 'Autres' : lineName);
    }
  }

  console.log('\nTerminé.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
