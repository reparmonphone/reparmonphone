// Remplace, dans la description longue des fiches produit, la phrase toute faite collée à l'import
// ("Leader en vente de pièces détachées de smartphones aux particuliers et professionnels") — une
// affirmation invérifiable repérée par un audit SEO externe — par une formulation plus sobre et
// crédible proposée par Krys : "Spécialiste français des pièces détachées pour smartphones et
// tablettes". La phrase apparaît toujours au même endroit dans la même tournure ("Leader en vente de
// pièces détachées de smartphones aux particuliers et professionnels, nous proposons..."), donc le
// remplacement s'insère proprement sans toucher au reste du texte.
//
// Usage :
//   node scripts/fix-leader-claim-in-products.js            (aperçu, aucune écriture)
//   node scripts/fix-leader-claim-in-products.js --apply     (applique réellement le remplacement)

require('dotenv').config({ path: require('path').join(__dirname, '../.env.migration') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');

const NEW_PHRASE = 'Spécialiste français des pièces détachées pour smartphones et tablettes';

// La phrase à remplacer existe en plusieurs variantes selon la catégorie du produit d'origine
// ("smartphones", "tablettes", "montres connectées"...) — repérées via le script de diagnostic
// (scripts/diagnose-leader-boilerplate.js). Toutes remplacées par la même formule générique
// ci-dessus (qui couvre déjà "smartphones et tablettes", donc reste juste dans tous les cas).
const OLD_PHRASES = [
  'Leader en vente de pièces détachées de smartphones aux particuliers et professionnels',
  'Leader en vente de pièces détachées de tablettes aux particuliers et professionnels',
  'Leader en vente de pièces détachées de montres connectées aux particuliers et professionnels',
];
// Rétro-compatibilité avec le reste du script, écrit à l'origine pour une seule phrase.
const OLD_PHRASE = OLD_PHRASES[0];

// Remplace, dans un texte donné, TOUTES les variantes connues de la phrase par la nouvelle formule.
function replaceAllVariants(text) {
  let result = text;
  for (const old of OLD_PHRASES) {
    result = result.split(old).join(NEW_PHRASE);
  }
  return result;
}

async function main() {
  // Un produit peut matcher n'importe laquelle des variantes — on récupère l'union des trois.
  const productsByVariant = await Promise.all(
    OLD_PHRASES.map((phrase) =>
      prisma.product.findMany({
        where: { description: { contains: phrase } },
        select: { id: true, slug: true, description: true },
      })
    )
  );
  const byId = new Map();
  for (const list of productsByVariant) {
    for (const p of list) byId.set(p.id, p);
  }
  const products = [...byId.values()];

  console.log(`${products.length} fiche(s) contenant une des ${OLD_PHRASES.length} variantes de la phrase à remplacer.`);
  for (const phrase of OLD_PHRASES) {
    const count = productsByVariant[OLD_PHRASES.indexOf(phrase)].length;
    console.log(`  - "${phrase.slice(0, 55)}..." : ${count} fiche(s)`);
  }

  if (products.length > 0) {
    // Un exemple par variante trouvée, pour vérifier chaque cas avant application.
    for (const phrase of OLD_PHRASES) {
      const sample = products.find((p) => p.description.includes(phrase));
      if (!sample) continue;
      const newDescription = replaceAllVariants(sample.description);
      const idx = sample.description.indexOf(phrase);
      console.log(`\nExemple — [${sample.slug}]`);
      console.log(`  avant : …${sample.description.slice(Math.max(0, idx - 40), idx + phrase.length + 40)}…`);
      const idx2 = newDescription.indexOf(NEW_PHRASE);
      console.log(`  après : …${newDescription.slice(Math.max(0, idx2 - 40), idx2 + NEW_PHRASE.length + 40)}…`);
    }
  }

  if (APPLY) {
    let updated = 0;
    for (const p of products) {
      const newDescription = replaceAllVariants(p.description);
      await prisma.product.update({ where: { id: p.id }, data: { description: newDescription } });
      updated++;
    }
    console.log(`\n✅ ${updated} fiche(s) mise(s) à jour.`);
  } else {
    console.log('\nAperçu uniquement — relance avec --apply pour appliquer réellement ce remplacement.');
  }

  // Repère les fiches qui contiennent "leader en vente" mais aucune des variantes connues ci-dessus
  // (catégorie encore différente, casse différente...) — donc pas touchées par le remplacement.
  // Comparaison par id, pas par présence de NEW_PHRASE : sinon, en aperçu (sans --apply), tout
  // ressortirait comme "non traité" puisque rien n'a encore été écrit.
  const knownIds = new Set(products.map((p) => p.id));
  const broaderMatches = await prisma.product.findMany({
    where: { description: { contains: 'eader en vente' } }, // insensible à la casse du "L" initial
    select: { id: true, slug: true, description: true },
  });
  const unknownVariants = broaderMatches.filter((p) => !knownIds.has(p.id));
  if (unknownVariants.length > 0) {
    console.log(`\n⚠️  ${unknownVariants.length} fiche(s) avec une variante encore différente (pas touchées par ce script) :`);
    for (const p of unknownVariants.slice(0, 10)) {
      const idx = p.description.toLowerCase().indexOf('eader en vente');
      console.log(`  - [${p.slug}] …${p.description.slice(Math.max(0, idx - 30), idx + 100).replace(/\s+/g, ' ')}…`);
    }
  } else {
    console.log('\n✅ Aucune variante restante — les 3 phrases couvrent tous les cas trouvés.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
