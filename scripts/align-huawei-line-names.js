/**
 * À lancer UNE SEULE FOIS après la mise en place de la synchro nom/image entre /admin/gammes et
 * la page publique /marque/huawei (voir src/app/marque/[...slug]/page.tsx).
 *
 * Avant ce changement, le titre affiché publiquement ("Gamme P", "Gamme Mate"...) venait d'un
 * fichier figé (data/category_content.json), généré une fois par scripts/consolidate-huawei-categories.js,
 * pendant que la base gardait des noms courts ("P", "Mate"...). Le nouveau code affiche désormais
 * le "name" de la base en priorité (pour que renommer une gamme dans /admin/gammes fonctionne
 * vraiment). Ce script aligne donc une bonne fois les noms en base sur ce qui est déjà affiché
 * publiquement aujourd'hui, pour qu'il n'y ait AUCUN changement visible au moment du déploiement.
 * Une fois lancé, tu peux renommer librement depuis /admin/gammes : ça se répercutera directement
 * sur le site public.
 *
 * MODE DRY-RUN (recommandé en premier) :
 *   node scripts/align-huawei-line-names.js --dry-run
 *
 * MODE RÉEL :
 *   node scripts/align-huawei-line-names.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const isDryRun = process.argv.includes('--dry-run');

// Correspondance nom actuel en base -> nom déjà affiché publiquement (voir DISPLAY_LABELS dans
// scripts/consolidate-huawei-categories.js). "Autres" et "Huawei" ne changent pas : ils s'affichent
// déjà tels quels, sans préfixe "Gamme ".
const RENAMES = {
  P: 'Gamme P',
  G: 'Gamme G',
  Mate: 'Gamme Mate',
  Nova: 'Gamme Nova',
  Y: 'Gamme Y',
  Ascend: 'Gamme Ascend',
};

async function main() {
  console.log(isDryRun ? '🧪 MODE DRY-RUN — aucune écriture ne sera faite.\n' : '⚠️  MODE RÉEL — la base va être modifiée.\n');

  const brand = await prisma.brand.findUnique({ where: { slug: 'huawei' } });
  if (!brand) {
    console.error('❌ Marque "Huawei" introuvable.');
    process.exit(1);
  }

  const lines = await prisma.productLine.findMany({ where: { brandId: brand.id } });

  for (const line of lines) {
    const newName = RENAMES[line.name];
    if (!newName || newName === line.name) {
      console.log(`   - "${line.name}" : inchangé`);
      continue;
    }
    console.log(`   - "${line.name}" -> "${newName}" (slug conservé : "${line.slug}")`);
    if (!isDryRun) {
      await prisma.productLine.update({ where: { id: line.id }, data: { name: newName } });
    }
  }

  console.log(isDryRun ? '\nPour appliquer réellement, relance sans --dry-run :\n   node scripts/align-huawei-line-names.js\n' : '\n✅ Terminé.');
}

main()
  .catch((e) => {
    console.error('💥 Erreur :', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
