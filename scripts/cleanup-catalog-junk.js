// Retire de la boutique publique (showInBoutique = false) les fiches produit identifiées comme
// invalides par scripts/diagnose-homepage-products.js le 2026-09-01 : 3 fiches à 0€ (prix
// manquant, jamais un vrai prix de vente) et 1 doublon "(Copie)" laissé par un copier-coller de
// catalogue. Ne supprime rien : la fiche reste en base (donc l'historique de commandes éventuel
// reste intact) mais n'apparaît plus dans la boutique, les pages marque/catégorie, la recherche,
// ni les carrousels de l'accueil.
//
// Si de nouveaux produits à 0€ ou "(Copie)" apparaissent plus tard, relance
// scripts/diagnose-homepage-products.js pour les repérer avant de les ajouter ici.
//
// Usage :
//   node scripts/cleanup-catalog-junk.js --dry-run
//   node scripts/cleanup-catalog-junk.js

require('dotenv').config({ path: require('path').join(__dirname, '../.env.migration') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes('--dry-run');

const SLUGS_TO_HIDE = [
  'nappe-connecteur-de-charge-ipad-pro-10-5-noir', // 0€
  'nappe-connecteur-de-charge-samsung-galaxy-z-flip5-5g-f731b-gh96-15970a-origine', // 0€
  'nappe-connecteur-de-charge-samsung-galaxy-m11-m115f-gh81-18737a-origine', // 0€
  'nappe-connecteur-de-charge-pour-iphone-15-pro-naturel-reconditionne-piec-copie', // doublon "(Copie)"
];

async function main() {
  console.log(DRY_RUN ? '--- MODE DRY-RUN (aucune écriture) ---\n' : '--- MISE À JOUR RÉELLE ---\n');

  for (const slug of SLUGS_TO_HIDE) {
    const product = await prisma.product.findUnique({ where: { slug } });
    if (!product) {
      console.log(`⚠️  Aucun produit trouvé pour le slug "${slug}" — déjà traité ou supprimé ?`);
      continue;
    }
    if (!product.showInBoutique) {
      console.log(`— "${product.title}" est déjà masqué (showInBoutique = false), rien à faire.`);
      continue;
    }
    console.log(`"${product.title}" [${product.price}€] → masquage de la boutique publique`);
    if (!DRY_RUN) {
      await prisma.product.update({ where: { slug }, data: { showInBoutique: false } });
      console.log('   ✅ masqué');
    }
  }

  console.log(DRY_RUN ? '\nDry-run terminé, aucune écriture effectuée.' : '\nTerminé.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
