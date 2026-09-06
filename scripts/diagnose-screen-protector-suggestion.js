/**
 * Diagnostic en lecture seule : reproduit exactement la logique de
 * src/lib/screenProtectorSuggestion.ts pour un produit donné (par son slug), et affiche chaque étape
 * pour comprendre pourquoi la suggestion de verre trempé n'apparaît pas sur une fiche écran.
 *
 * Usage :
 *   node scripts/diagnose-screen-protector-suggestion.js ecran-iphone-15-pro-incell-120hz-optimum
 */

const path = require('path');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: path.join(__dirname, '../.env.migration') });

const prisma = new PrismaClient();

function matchesDeviceModel(title, modelName) {
  const escaped = modelName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(^|[^a-z0-9])${escaped}(?![a-z0-9]|\\s*(pro|plus|max|mini|ultra|\\+|e\\b))`, 'i');
  return re.test(title);
}

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error('Usage : node scripts/diagnose-screen-protector-suggestion.js <slug-du-produit>');
    process.exit(1);
  }

  const product = await prisma.product.findUnique({
    where: { slug },
    include: { model: { include: { productLine: { include: { brand: true } } } } },
  });
  if (!product) {
    console.error(`Produit introuvable pour le slug "${slug}".`);
    process.exit(1);
  }

  console.log(`Produit : "${product.title}"`);
  console.log(`pieceType : ${product.pieceType}`);
  console.log(`Modèle : "${product.model.name}" (marque: ${product.model.productLine.brand.name}, gamme: ${product.model.productLine.name})\n`);

  if (product.pieceType !== 'ECRAN') {
    console.log('❌ Ce produit n\'est PAS de type ECRAN — la suggestion ne se déclenche jamais pour ce type de pièce.');
    await prisma.$disconnect();
    return;
  }

  const brand = await prisma.brand.findFirst({ where: { name: 'Accessoires' } });
  console.log(brand ? `✅ Marque "Accessoires" trouvée (id: ${brand.id})` : '❌ Marque "Accessoires" INTROUVABLE');
  if (!brand) return prisma.$disconnect();

  const line = await prisma.productLine.findFirst({ where: { brandId: brand.id, slug: 'protection-ecran' } });
  console.log(line ? `✅ Gamme "protection-ecran" trouvée (id: ${line.id}, nom: "${line.name}")` : '❌ Gamme "protection-ecran" INTROUVABLE sous Accessoires');
  if (!line) return prisma.$disconnect();

  const allInLine = await prisma.product.findMany({
    where: { model: { productLineId: line.id } },
    select: { title: true, showInBoutique: true, inStock: true },
  });
  console.log(`\n${allInLine.length} produit(s) au total dans "Protection Écran" (toutes conditions confondues).`);

  const eligible = allInLine.filter((p) => p.showInBoutique && p.inStock);
  console.log(`${eligible.length} produit(s) avec showInBoutique=true ET inStock=true (ce que la suggestion regarde réellement).\n`);

  const matches = eligible.filter((p) => matchesDeviceModel(p.title, product.model.name));
  console.log(`--- Résultat pour le modèle "${product.model.name}" ---`);
  if (matches.length === 0) {
    console.log('❌ Aucune correspondance précise trouvée parmi les produits éligibles.\n');
    console.log('Aperçu de titres contenant juste le mot du modèle (sans le filtre strict), pour comparaison :');
    const loose = allInLine.filter((p) => p.title.toLowerCase().includes(product.model.name.toLowerCase()));
    loose.slice(0, 15).forEach((p) => console.log(`   - [showInBoutique=${p.showInBoutique}, inStock=${p.inStock}] "${p.title}"`));
    if (loose.length === 0) console.log('   (aucun titre ne contient même le nom du modèle en texte brut)');
  } else {
    console.log(`✅ ${matches.length} correspondance(s) trouvée(s) :`);
    matches.forEach((p) => console.log(`   - "${p.title}"`));
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
