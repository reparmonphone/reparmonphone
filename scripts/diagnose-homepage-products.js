// Diagnostic en lecture seule (aucune écriture) pour comprendre pourquoi la page d'accueil
// ("Top Nouveautés" / "Top Produits") affiche parfois des articles bizarres : produits à 0€,
// doublons "(Copie)", très vieux modèles (iPhone 4, XS, XR...). Ces sections piochent
// actuellement un échantillon ALÉATOIRE dans tout le catalogue visible en boutique, sans filtrer
// ni trier par date/qualité — ce script mesure l'ampleur du problème avant qu'on corrige le code.
//
// Usage :
//   node scripts/diagnose-homepage-products.js

require('dotenv').config({ path: require('path').join(__dirname, '../.env.migration') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const eligibleWhere = { inStock: true, showInBoutique: true };
  const totalEligible = await prisma.product.count({ where: eligibleWhere });
  console.log(`Produits éligibles à l'affichage homepage (inStock + showInBoutique) : ${totalEligible}\n`);

  // 1) Produits à 0€ ou prix manquant/négatif
  const zeroPrice = await prisma.product.findMany({
    where: { ...eligibleWhere, OR: [{ price: { lte: 0 } }] },
    select: { id: true, title: true, price: true, slug: true },
    take: 20,
  });
  console.log(`--- Produits à 0€ ou prix <= 0 (${zeroPrice.length} affichés, max 20) ---`);
  zeroPrice.forEach((p) => console.log(`  [${p.price}€] ${p.title}  (/produit/${p.slug})`));
  console.log();

  // 2) Titres contenant "copie" / "copy" / "(2)" — artefacts de duplication
  const copyLike = await prisma.product.findMany({
    where: {
      ...eligibleWhere,
      OR: [
        { title: { contains: 'copie', mode: 'insensitive' } },
        { title: { contains: 'copy', mode: 'insensitive' } },
        { title: { contains: '(2)' } },
      ],
    },
    select: { id: true, title: true, price: true, slug: true, createdAt: true },
    take: 30,
  });
  console.log(`--- Titres suspects "(Copie)" / "Copy" / "(2)" (${copyLike.length} affichés, max 30) ---`);
  copyLike.forEach((p) => console.log(`  [${p.price}€] ${p.title}  (/produit/${p.slug})  créé le ${p.createdAt.toISOString().slice(0, 10)}`));
  console.log();

  // 3) Distribution des dates de création — pour savoir si "trier par date de création" a un
  // sens (produits ajoutés au fil du temps) ou si tout a été importé en bloc à la même date
  // (auquel cas trier par date ne distinguerait pas vraiment le "récent" de l'"ancien").
  const dateGroups = await prisma.$queryRawUnsafe(`
    SELECT DATE("createdAt") as day, COUNT(*)::int as count
    FROM products
    WHERE "inStock" = true AND "showInBoutique" = true
    GROUP BY DATE("createdAt")
    ORDER BY day ASC
  `);
  console.log(`--- Répartition des dates de création (${dateGroups.length} jours distincts) ---`);
  dateGroups.forEach((row) => console.log(`  ${row.day.toISOString().slice(0, 10)} : ${row.count} produits`));
  console.log();

  // 4) Exemples de très vieux modèles actuellement éligibles (iPhone 4/5, etc.) pour illustrer
  // ce qui peut sortir du tirage aléatoire.
  const oldModels = await prisma.product.findMany({
    where: {
      ...eligibleWhere,
      OR: [
        { title: { contains: 'iPhone 4', mode: 'insensitive' } },
        { title: { contains: 'iPhone 5', mode: 'insensitive' } },
        { title: { contains: 'iPhone 3', mode: 'insensitive' } },
      ],
    },
    select: { id: true, title: true, price: true, slug: true },
    take: 20,
  });
  console.log(`--- Très vieux modèles actuellement éligibles (${oldModels.length} affichés, max 20) ---`);
  oldModels.forEach((p) => console.log(`  [${p.price}€] ${p.title}  (/produit/${p.slug})`));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
