/**
 * Corrige 3 cas précis et confirmés à la main (voir la sortie de investigate-unknown-codes.js) :
 *
 * 1) Le modèle "S21+" (gamme Galaxy S) est un "bare" jamais rattaché au CSV fournisseur, alors que le
 *    CSV a bien une ligne "S21+ 5G (G996B)" — contrairement au cas A72 4G/A72 5G (deux VRAIS téléphones
 *    différents), ici "S21+" et "S21+ 5G (G996B)" sont le MÊME téléphone (Samsung n'a jamais vendu de
 *    S21+ 4G) : on renomme donc simplement "S21+" -> "S21+ 5G (G996B)" pour qu'il devienne "précis" et
 *    profite ensuite automatiquement de add-samsung-reference-codes.js / reclassify-*.
 *
 * 2) Il existe une gamme fantôme "Samsung Galaxy" (distincte de la vraie gamme "Galaxy A"), reliquat
 *    d'une ancienne structure, contenant 2 modèles orphelins : "A21s" (5 produits) et "A50s"
 *    (2 produits). Leurs équivalents corrects existent déjà dans la gamme "Galaxy A" : "A21s 2020" et
 *    "A50s 2019". On fusionne (déplace les produits puis supprime le modèle orphelin, comme le bouton
 *    🔀 de /admin/gammes) :
 *      Samsung Galaxy/A21s -> Galaxy A/A21s 2020
 *      Samsung Galaxy/A50s -> Galaxy A/A50s 2019
 *
 * Tout le reste identifié par investigate-unknown-codes.js (Galaxy Z, S5 Active/G870F, S21 Ultra/G998U,
 * A53 bare, A10-M10/A105, J4 2018-J7/SM-J400, montres Watch R7xx...) est laissé volontairement
 * INCHANGÉ : soit déjà correctement placé à la main (Z), soit un modèle hors périmètre du CSV
 * (S5 Active, montres), soit un doublon "bare" déjà jugé sans risque par toi (A53).
 *
 * MODE DRY-RUN (recommandé en premier) :
 *   node scripts/fix-samsung-orphan-models.js --dry-run
 * MODE RÉEL :
 *   node scripts/fix-samsung-orphan-models.js
 */

const path = require('path');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: path.join(__dirname, '../.env.migration') });

const prisma = new PrismaClient();
const isDryRun = process.argv.includes('--dry-run');

async function findModel(lineName, modelName) {
  return prisma.model.findFirst({
    where: { name: modelName, productLine: { name: lineName } },
    include: { productLine: true, _count: { select: { products: true } } },
  });
}

async function main() {
  console.log(isDryRun ? '🧪 MODE DRY-RUN — aucune écriture ne sera faite.\n' : '⚠️  MODE RÉEL — la base va être modifiée.\n');

  // --- 1) Renommage S21+ -> S21+ 5G (G996B) ---
  const s21plus = await findModel('Galaxy S', 'S21+');
  if (!s21plus) {
    console.log('ℹ️  Modèle "Galaxy S/S21+" introuvable (déjà renommé, ou nom différent) — étape ignorée.');
  } else {
    console.log(`✏️  Renommage : [Galaxy S] "S21+" (${s21plus._count.products} produit(s)) -> "S21+ 5G (G996B)"`);
    if (!isDryRun) {
      await prisma.model.update({ where: { id: s21plus.id }, data: { name: 'S21+ 5G (G996B)' } });
    }
  }

  // --- 2) Fusions gamme fantôme "Samsung Galaxy" -> "Galaxy A" ---
  const mergePairs = [
    { fromLine: 'Samsung Galaxy', fromModel: 'A21s', toLine: 'Galaxy A', toModel: 'A21s 2020' },
    { fromLine: 'Samsung Galaxy', fromModel: 'A50s', toLine: 'Galaxy A', toModel: 'A50s 2019' },
  ];

  for (const { fromLine, fromModel, toLine, toModel } of mergePairs) {
    const source = await findModel(fromLine, fromModel);
    const target = await findModel(toLine, toModel);
    if (!source) {
      console.log(`ℹ️  Modèle source [${fromLine}/${fromModel}] introuvable — étape ignorée.`);
      continue;
    }
    if (!target) {
      console.log(`⚠️  Modèle cible [${toLine}/${toModel}] introuvable — fusion IMPOSSIBLE, laissé inchangé.`);
      continue;
    }
    console.log(
      `🔀 Fusion : [${fromLine}] "${fromModel}" (${source._count.products} produit(s)) -> [${toLine}] "${toModel}" (${target._count.products} produit(s) actuellement)`
    );
    if (!isDryRun) {
      await prisma.product.updateMany({ where: { modelId: source.id }, data: { modelId: target.id } });
      await prisma.model.delete({ where: { id: source.id } });
    }
  }

  console.log('\n-------------------------------------------------------------');
  if (isDryRun) {
    console.log('Relis bien le rapport ci-dessus avant de lancer en réel.');
    console.log('Pour appliquer réellement : node scripts/fix-samsung-orphan-models.js');
  } else {
    console.log('✅ Terminé. La gamme "Samsung Galaxy" est probablement vide de modèles maintenant : tu peux vérifier dans /admin/gammes et la supprimer si un bouton le permet.');
  }
}

main()
  .catch((e) => {
    console.error('💥 Erreur :', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
