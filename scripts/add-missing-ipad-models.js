// Crée les 2 modèles iPad repérés comme manquants lors de l'import scripts/import-ipad-products.js
// (2 produits du CSV fournisseur n'avaient aucun modèle correspondant en base) :
//   - "iPad Pro 11" (2ème Gén.) (2020)"  dans la gamme "iPad Pro"
//   - "iPad Air 5 (2022)"                 dans la gamme "iPad Air"
//
// Chaque modèle est inséré juste après son prédécesseur chronologique (iPad Pro 11" 1er Gén. 2018
// pour le premier, iPad Air 4 pour le second), en décalant de +1 le sortOrder de tous les modèles
// qui le suivaient déjà dans la même gamme — l'ordre existant des AUTRES modèles n'est donc jamais
// perturbé, seul le nouveau vient s'intercaler à la bonne place chronologique.
//
// Ce script NE TOUCHE À AUCUN PRODUIT — une fois les modèles créés, il suffit de relancer
// `node scripts/import-ipad-products.js scripts/Ipads.csv` : les 2 produits jusque-là ignorés
// trouveront alors une correspondance et seront importés (tout le reste, déjà importé, sera
// re-détecté comme doublon et laissé de côté, sans rien dupliquer).
//
// Usage :
//   node scripts/add-missing-ipad-models.js            (aperçu, aucune écriture)
//   node scripts/add-missing-ipad-models.js --apply     (applique réellement la création)

require('dotenv').config({ path: require('path').join(__dirname, '../.env.migration') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');

function slugify(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

// { lineSlug, name, afterModelSlug } — le nouveau modèle est inséré juste après "afterModelSlug"
// dans la gamme "lineSlug".
const NEW_MODELS = [
  { lineSlug: 'ipad-pro', name: 'iPad Pro 11" 2020 (2e Gen)', afterModelSlug: 'ipad-pro-11-2018-1e-gen' },
  { lineSlug: 'ipad-air', name: 'iPad Air 5 (2022)', afterModelSlug: 'ipad-air-6-13-2024-m2' },
];

async function uniqueModelSlug(productLineId, name) {
  const base = slugify(name) || 'modele';
  let slug = base;
  let i = 1;
  while (await prisma.model.findFirst({ where: { productLineId, slug } })) {
    i += 1;
    slug = `${base}-${i}`;
  }
  return slug;
}

async function main() {
  console.log(APPLY ? 'MODE REEL - la base va etre modifiee.\n' : 'MODE APERCU - aucune ecriture ne sera faite.\n');

  for (const spec of NEW_MODELS) {
    const line = await prisma.productLine.findFirst({
      where: { slug: spec.lineSlug },
      include: { models: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!line) {
      console.log(`❌ Gamme "${spec.lineSlug}" introuvable — "${spec.name}" ignoré.\n`);
      continue;
    }

    console.log(`Ordre actuel de la gamme "${line.name}" : ${line.models.map((m) => `"${m.name}" (${m.sortOrder})`).join(' > ')}\n`);

    const already = line.models.find((m) => slugify(m.name) === slugify(spec.name));
    if (already) {
      console.log(`✅ "${spec.name}" existe déjà dans "${line.name}" (id: ${already.id}) — rien à faire.\n`);
      continue;
    }

    const after = line.models.find((m) => m.slug === spec.afterModelSlug);
    if (!after) {
      console.log(`❌ Modèle repère "${spec.afterModelSlug}" introuvable dans "${line.name}" — "${spec.name}" ignoré.\n`);
      continue;
    }

    const newSortOrder = after.sortOrder + 1;
    const toShift = line.models.filter((m) => m.sortOrder >= newSortOrder);

    console.log(`Gamme "${line.name}" : insertion de "${spec.name}" juste après "${after.name}" (sortOrder ${newSortOrder}).`);
    if (toShift.length > 0) {
      console.log(`  -> décale +1 le sortOrder de ${toShift.length} modèle(s) suivant(s) : ${toShift.map((m) => `"${m.name}"`).join(', ')}`);
    } else {
      console.log('  -> aucun modèle suivant à décaler (insertion en fin de gamme).');
    }

    if (APPLY) {
      // Décale d'abord les modèles suivants (en partant du plus grand sortOrder, pour éviter toute
      // collision transitoire sur la contrainte unique [productLineId, slug] — qui ne porte de
      // toute façon pas sur sortOrder, mais on garde l'ordre par prudence).
      for (const m of [...toShift].sort((a, b) => b.sortOrder - a.sortOrder)) {
        await prisma.model.update({ where: { id: m.id }, data: { sortOrder: m.sortOrder + 1 } });
      }

      const slug = await uniqueModelSlug(line.id, spec.name);
      const created = await prisma.model.create({
        data: {
          name: spec.name,
          slug,
          productLineId: line.id,
          sortOrder: newSortOrder,
        },
      });
      console.log(`  ✅ Modèle créé : "${created.name}" (id: ${created.id}, slug: "${created.slug}")`);
    }
    console.log('');
  }

  if (!APPLY) {
    console.log('Aperçu uniquement — relance avec --apply pour créer réellement ces modèles.');
    console.log('Ensuite, relance node scripts/import-ipad-products.js scripts/Ipads.csv pour importer les 2 produits en attente.');
  } else {
    console.log('Terminé. Tu peux maintenant relancer :');
    console.log('   node scripts/import-ipad-products.js scripts/Ipads.csv');
    console.log('pour importer les 2 produits qui étaient en attente (le reste sera re-détecté comme déjà importé).');
  }
}

main()
  .catch((e) => {
    console.error('Erreur :', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
