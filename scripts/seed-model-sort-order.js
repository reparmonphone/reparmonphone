// Initialise Model.sortOrder pour TOUTES les gammes de TOUTES les marques, une seule fois, en
// reprenant exactement le tri automatique "du plus récent au plus ancien" déjà en place sur
// /marque/[marque]/[gamme] (numéro de génération, puis Ultra/+/base/FE/Edge, puis alphabétique).
// Résultat : l'affichage du site ne change PAS au moment où ce script tourne — seuls les nombres
// stockés changent (0, 1, 2...) pour que /admin/gammes puisse ensuite proposer les flèches ▲▼ de
// réorganisation manuelle, à partir de cet ordre de départ.
//
// À lancer UNE FOIS, après avoir ajouté la colonne sortOrder au schéma (npm run db:push) et avant
// de déployer les flèches de réorganisation dans l'admin.
//
// Usage :
//   node scripts/seed-model-sort-order.js --dry-run
//   node scripts/seed-model-sort-order.js

require('dotenv').config({ path: require('path').join(__dirname, '../.env.migration') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes('--dry-run');

function extractModelGeneration(name) {
  const base = name.replace(/\s*\([^)]*\)\s*$/, '').trim();
  const match = base.match(/(\d{1,3})/);
  return match ? parseInt(match[1], 10) : -1;
}

function modelVariantRank(name) {
  const base = name.replace(/\s*\([^)]*\)\s*$/, '').trim().toUpperCase().replace(/\s+/g, ' ');
  if (/ULTRA/.test(base)) return 0;
  if (/\+|\bPLUS\b/.test(base)) return 1;
  if (/^S\s*\d*\s*(5G|4G)?$/.test(base)) return 2;
  if (/\bFE\b/.test(base)) return 3;
  if (/EDGE/.test(base)) return 4;
  return 5;
}

function sortByRecency(models) {
  return [...models].sort((a, b) => {
    const genDiff = extractModelGeneration(b.name) - extractModelGeneration(a.name);
    if (genDiff !== 0) return genDiff;
    const rankDiff = modelVariantRank(a.name) - modelVariantRank(b.name);
    if (rankDiff !== 0) return rankDiff;
    return a.name.localeCompare(b.name, 'fr');
  });
}

async function main() {
  const lines = await prisma.productLine.findMany({
    include: { brand: true, models: { select: { id: true, name: true } } },
  });

  console.log(DRY_RUN ? '--- MODE DRY-RUN (aucune écriture) ---\n' : '--- INITIALISATION RÉELLE ---\n');

  let totalUpdated = 0;

  for (const line of lines) {
    if (line.models.length === 0) continue;
    const ordered = sortByRecency(line.models);

    console.log(`${line.brand.name} / ${line.name} (${ordered.length} modèle(s))`);
    if (DRY_RUN) {
      ordered.forEach((m, i) => console.log(`  ${i}. ${m.name}`));
      continue;
    }

    for (let i = 0; i < ordered.length; i++) {
      await prisma.model.update({ where: { id: ordered[i].id }, data: { sortOrder: i } });
      totalUpdated++;
    }
  }

  console.log('\n--- RÉSUMÉ ---');
  if (DRY_RUN) {
    console.log('Relance sans --dry-run pour appliquer réellement.');
  } else {
    console.log(`${totalUpdated} modèle(s) initialisé(s).`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
