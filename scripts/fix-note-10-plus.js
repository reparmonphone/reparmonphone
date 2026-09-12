// Corrige le bug "pas de Note 10+ dans l'admin" : la carte "Note 10+" affichée sur la page
// publique /marque/samsung/galaxy-note est une carte STATIQUE (reliquat du scrap WordPress) dont
// le lien est cassé (elle pointe vers ".../note-10-galaxy-note/" au lieu d'un vrai slug) — elle ne
// se raccroche donc à aucun modèle réel, et ses "26 produits" viennent d'une recherche floue sur
// le titre, pas d'un vrai modèle en base.
//
// En réalité, tous les produits "Note 10+ (N975F)" ont été rangés, à la migration, sous le modèle
// "Note 10 (N970F)" au lieu d'avoir leur propre modèle — c'est pour ça qu'admin n'affiche jamais
// de "Note 10+" séparé.
//
// Ce script :
//   1. Crée un vrai modèle "Note 10+ (N975F)" dans la gamme Galaxy Note (juste après "Note 10").
//   2. Déplace vers ce nouveau modèle les produits actuellement sous "Note 10 (N970F)" dont le
//      titre mentionne clairement "N975F" / "Note 10+" SANS mentionner aussi le code "N970F" (ce
//      qui indiquerait une pièce compatible avec les deux modèles, donc volontairement laissée en
//      place sous "Note 10").
//
// Par défaut : mode APERÇU (aucune écriture). Ajouter --apply pour exécuter réellement.
//
// Usage :
//   node scripts/fix-note-10-plus.js            (aperçu)
//   node scripts/fix-note-10-plus.js --apply     (exécution réelle)

require('dotenv').config({ path: require('path').join(__dirname, '../.env.migration') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');

const SOURCE_MODEL_ID = 'cmrrmpoe505rsw13grwv4nned'; // "Note 10 (N970F)"
const NEW_MODEL_NAME = 'Note 10+ (N975F)';
const NEW_MODEL_SLUG = 'note-10-plus';

function shouldMove(title) {
  const hasPlusRef = /N975F|Note\s*10\s*\+/i.test(title);
  const hasBaseCode = /N970F/i.test(title);
  return hasPlusRef && !hasBaseCode;
}

async function main() {
  const sourceModel = await prisma.model.findUnique({
    where: { id: SOURCE_MODEL_ID },
    include: { productLine: true },
  });
  if (!sourceModel) {
    console.log(`Modèle source introuvable (id=${SOURCE_MODEL_ID}). Abandon.`);
    return;
  }
  console.log(`Modèle source : "${sourceModel.name}" (gamme "${sourceModel.productLine.name}")\n`);

  const products = await prisma.product.findMany({
    where: { modelId: SOURCE_MODEL_ID },
    select: { id: true, title: true, slug: true },
    orderBy: { title: 'asc' },
  });

  const toMove = products.filter((p) => shouldMove(p.title));
  const toKeep = products.filter((p) => !shouldMove(p.title));

  console.log(`========== À DÉPLACER vers "${NEW_MODEL_NAME}" (${toMove.length} produits) ==========`);
  for (const p of toMove) console.log(`  → "${p.title}"`);

  console.log(`\n========== CONSERVÉS sous "${sourceModel.name}" (${toKeep.length} produits) ==========`);
  for (const p of toKeep) console.log(`  = "${p.title}"`);

  if (toMove.length === 0) {
    console.log('\nAucun produit à déplacer — rien à faire.');
    return;
  }

  if (!APPLY) {
    console.log(`\n(Aperçu uniquement — relance avec --apply pour créer le modèle "${NEW_MODEL_NAME}" et déplacer les ${toMove.length} produits ci-dessus.)`);
    return;
  }

  console.log('\n--apply détecté : exécution...');

  const existing = await prisma.model.findUnique({
    where: { productLineId_slug: { productLineId: sourceModel.productLineId, slug: NEW_MODEL_SLUG } },
  });
  if (existing) {
    console.log(`Le modèle "${NEW_MODEL_NAME}" existe déjà (id=${existing.id}) — on réutilise ce modèle plutôt que d'en créer un nouveau.`);
  }

  const newModel = existing
    ? existing
    : await prisma.model.create({
        data: {
          name: NEW_MODEL_NAME,
          slug: NEW_MODEL_SLUG,
          productLineId: sourceModel.productLineId,
          sortOrder: sourceModel.sortOrder + 1,
        },
      });
  console.log(`Modèle cible : id=${newModel.id} name="${newModel.name}" sortOrder=${newModel.sortOrder}`);

  // Décale les modèles suivants d'un cran pour laisser la place au nouveau, sauf si on a réutilisé
  // un modèle déjà existant (le rangement est alors déjà en place).
  if (!existing) {
    await prisma.model.updateMany({
      where: {
        productLineId: sourceModel.productLineId,
        sortOrder: { gt: sourceModel.sortOrder },
        id: { not: newModel.id },
      },
      data: { sortOrder: { increment: 1 } },
    });
  }

  const result = await prisma.product.updateMany({
    where: { id: { in: toMove.map((p) => p.id) } },
    data: { modelId: newModel.id },
  });
  console.log(`${result.count} produits déplacés vers "${newModel.name}".`);

  const verify = await prisma.model.findUnique({
    where: { id: newModel.id },
    include: { _count: { select: { products: true } } },
  });
  console.log(`Vérification : "${verify.name}" contient maintenant ${verify._count.products} produits.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
