// Corrige le texte fournisseur obsolète trouvé identique sur 7887 fiches produits (voir
// inspect-35-euros-boilerplate.js) : "Envois gratuits dès 35 euros." → remplacé par la vraie règle du
// site, "Livraison gratuite dès 250€ d'achat en France métropolitaine." Un seul UPDATE SQL (REPLACE),
// bien plus rapide et fiable qu'une boucle produit par produit sur un aussi gros volume.
//
// Usage :
//   node scripts/fix-35-euros-boilerplate.js            (aperçu, aucune écriture)
//   node scripts/fix-35-euros-boilerplate.js --apply     (applique réellement le remplacement)

require('dotenv').config({ path: require('path').join(__dirname, '../.env.migration') });
const { PrismaClient, Prisma } = require('@prisma/client');
const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');

const OLD_SENTENCE = 'Envois gratuits dès 35 euros.';
const NEW_SENTENCE = "Livraison gratuite dès 250€ d'achat en France métropolitaine.";

async function main() {
  const affected = await prisma.product.findMany({
    where: { shortDescription: { contains: OLD_SENTENCE } },
    select: { id: true, title: true, slug: true, shortDescription: true },
  });

  console.log(`Produits concernés : ${affected.length}`);
  console.log(`\nAncienne phrase : "${OLD_SENTENCE}"`);
  console.log(`Nouvelle phrase : "${NEW_SENTENCE}"`);

  console.log('\n--- Aperçu (3 exemples) ---');
  for (const p of affected.slice(0, 3)) {
    const after = p.shortDescription.split(OLD_SENTENCE).join(NEW_SENTENCE);
    console.log(`\n${p.title} (/produit/${p.slug})`);
    console.log('  Avant :', p.shortDescription);
    console.log('  Après :', after);
  }

  if (!APPLY) {
    console.log('\nAperçu uniquement — relance avec --apply pour appliquer réellement ce remplacement sur les '
      + affected.length + ' produits.');
    return;
  }

  const result = await prisma.$executeRaw(
    Prisma.sql`UPDATE products SET "shortDescription" = REPLACE("shortDescription", ${OLD_SENTENCE}, ${NEW_SENTENCE}) WHERE "shortDescription" LIKE ${'%' + OLD_SENTENCE + '%'}`
  );
  console.log(`\n✅ ${result} produit(s) mis à jour.`);

  const stillLeft = await prisma.product.count({ where: { shortDescription: { contains: OLD_SENTENCE } } });
  console.log(`Vérification : ${stillLeft} produit(s) contiennent encore l'ancienne phrase (devrait être 0).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
