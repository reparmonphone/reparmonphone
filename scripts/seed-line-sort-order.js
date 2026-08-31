// Initialise ProductLine.sortOrder pour TOUTES les gammes de TOUTES les marques, une seule fois,
// en les classant par ordre alphabétique (français) au sein de chaque marque.
// Résultat : l'affichage du site ne change quasiment pas au moment où ce script tourne — seuls les
// nombres stockés changent (0, 1, 2...) pour que /admin/gammes puisse ensuite proposer le
// glisser-déposer de réorganisation manuelle, à partir de cet ordre de départ.
//
// À lancer UNE FOIS, après avoir ajouté la colonne sortOrder au schéma (npm run db:push) et avant
// de déployer le glisser-déposer des gammes dans l'admin.
//
// Usage :
//   node scripts/seed-line-sort-order.js --dry-run
//   node scripts/seed-line-sort-order.js

require('dotenv').config({ path: require('path').join(__dirname, '../.env.migration') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  const brands = await prisma.brand.findMany({
    include: { lines: { select: { id: true, name: true } } },
    orderBy: { name: 'asc' },
  });

  console.log(DRY_RUN ? '--- MODE DRY-RUN (aucune écriture) ---\n' : '--- INITIALISATION RÉELLE ---\n');

  let totalUpdated = 0;

  for (const brand of brands) {
    if (brand.lines.length === 0) continue;
    const ordered = [...brand.lines].sort((a, b) => a.name.localeCompare(b.name, 'fr'));

    console.log(`${brand.name} (${ordered.length} gamme(s))`);
    if (DRY_RUN) {
      ordered.forEach((l, i) => console.log(`  ${i}. ${l.name}`));
      continue;
    }

    for (let i = 0; i < ordered.length; i++) {
      await prisma.productLine.update({ where: { id: ordered[i].id }, data: { sortOrder: i } });
      totalUpdated++;
    }
  }

  console.log('\n--- RÉSUMÉ ---');
  if (DRY_RUN) {
    console.log('Relance sans --dry-run pour appliquer réellement.');
  } else {
    console.log(`${totalUpdated} gamme(s) initialisée(s).`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
