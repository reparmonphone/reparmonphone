/**
 * Corrige un doublon détecté par scripts/list-samsung-s23plus-models.js : deux modèles "S23+"
 * existent en base (créés à des moments différents, avant/après le correctif "+" de cette
 * session) :
 *   - id=cmrrmneum0416w13gt6ci45y4  name="S23+"  slug="s23"        (ancien, slug hérité incorrect)
 *   - id=cmtfy9u360083w1fc7hrwpa1r  name="S23+"  slug="s23-plus"   (créé plus tard, slug correct)
 *
 * Ce doublon bloque aussi le modèle "S23" tout court (créé avec le slug moche "s23-2" car "s23"
 * était déjà pris par l'ancien "S23+").
 *
 * Ce script :
 *   1) Déplace vers le modèle survivant (slug "s23-plus") tout Product/RepairGuide qui serait
 *      encore rattaché à l'ancien modèle (id "s23"), s'il y en a.
 *   2) Supprime l'ancien modèle doublon (id "s23").
 *   3) Renomme le slug du modèle "S23" tout court de "s23-2" vers "s23" (libéré à l'étape 2).
 *
 * MODE DRY-RUN (recommandé en premier) :
 *   node scripts/merge-s23-plus-duplicate.js --dry-run
 *
 * MODE RÉEL :
 *   node scripts/merge-s23-plus-duplicate.js
 */

const path = require('path');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: path.join(__dirname, '../.env.migration') });

const prisma = new PrismaClient();
const isDryRun = process.argv.includes('--dry-run');

const OLD_S23_PLUS_ID = 'cmrrmneum0416w13gt6ci45y4'; // name="S23+", slug="s23" (à supprimer)
const NEW_S23_PLUS_ID = 'cmtfy9u360083w1fc7hrwpa1r'; // name="S23+", slug="s23-plus" (survivant)
const S23_BARE_ID = 'cmtfz34mw000lw1i8bcrbev48'; // name="S23", slug="s23-2" (à renommer en "s23")

async function main() {
  console.log(isDryRun ? '🧪 MODE DRY-RUN — aucune écriture ne sera faite.\n' : '⚠️  MODE RÉEL — la base va être modifiée.\n');

  const [oldModel, newModel, bareModel] = await Promise.all([
    prisma.model.findUnique({ where: { id: OLD_S23_PLUS_ID }, include: { _count: { select: { products: true, repairGuides: true } } } }),
    prisma.model.findUnique({ where: { id: NEW_S23_PLUS_ID } }),
    prisma.model.findUnique({ where: { id: S23_BARE_ID } }),
  ]);

  if (!oldModel || !newModel || !bareModel) {
    console.error('❌ Un des 3 modèles attendus est introuvable en base (id changé depuis le diagnostic ?). Abandon.');
    console.log({ oldModel: !!oldModel, newModel: !!newModel, bareModel: !!bareModel });
    process.exit(1);
  }
  if (oldModel.name !== 'S23+' || newModel.name !== 'S23+' || bareModel.name !== 'S23') {
    console.error('❌ Les noms ne correspondent plus à ce qui était attendu. Abandon par sécurité.');
    console.log({ oldModel, newModel, bareModel });
    process.exit(1);
  }

  console.log(`Ancien "S23+" (slug "${oldModel.slug}") : ${oldModel._count.products} produit(s), ${oldModel._count.repairGuides} guide(s) de réparation.`);
  console.log(`Nouveau "S23+" (slug "${newModel.slug}") : survivant.`);
  console.log(`"S23" (slug actuel "${bareModel.slug}") : sera renommé en "s23".\n`);

  if (oldModel._count.products > 0) {
    console.log(`-> ${oldModel._count.products} produit(s) seront déplacés vers le modèle survivant.`);
    if (!isDryRun) {
      await prisma.product.updateMany({ where: { modelId: OLD_S23_PLUS_ID }, data: { modelId: NEW_S23_PLUS_ID } });
    }
  }
  if (oldModel._count.repairGuides > 0) {
    console.log(`-> ${oldModel._count.repairGuides} guide(s) de réparation seront déplacés vers le modèle survivant.`);
    if (!isDryRun) {
      await prisma.repairGuide.updateMany({ where: { modelId: OLD_S23_PLUS_ID }, data: { modelId: NEW_S23_PLUS_ID } });
    }
  }

  console.log(`-> Suppression de l'ancien modèle doublon (id ${OLD_S23_PLUS_ID}, slug "${oldModel.slug}").`);
  if (!isDryRun) {
    await prisma.model.delete({ where: { id: OLD_S23_PLUS_ID } });
  }

  console.log(`-> Renommage du slug de "S23" : "${bareModel.slug}" -> "s23".`);
  if (!isDryRun) {
    await prisma.model.update({ where: { id: S23_BARE_ID }, data: { slug: 's23' } });
  }

  console.log(isDryRun ? '\n🧪 Dry-run terminé, rien n\'a été modifié.' : '\n✅ Terminé.');
  if (isDryRun) {
    console.log('Pour appliquer réellement : node scripts/merge-s23-plus-duplicate.js');
  }
}

main()
  .catch((e) => {
    console.error('💥 Erreur :', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
