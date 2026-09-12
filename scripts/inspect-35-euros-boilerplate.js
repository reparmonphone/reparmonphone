// Diagnostic en lecture seule : le texte "Envois gratuits dès 35 euros" trouvé sur 7888 produits (voir
// find-free-shipping-mentions.js) vient visiblement d'un texte standard injecté à l'import fournisseur
// dans Product.shortDescription. Avant de le remplacer partout en une seule fois, ce script vérifie
// que la phrase exacte est bien identique sur tous les produits concernés (pour un remplacement fiable
// et sans surprise), et affiche le texte COMPLET (non tronqué) de quelques exemples.
//
// Usage :
//   node scripts/inspect-35-euros-boilerplate.js

require('dotenv').config({ path: require('path').join(__dirname, '../.env.migration') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TARGET_SENTENCE = /Envois gratuits d[eè]s 35\s*euros\.?/gi;

async function main() {
  const products = await prisma.product.findMany({
    where: { shortDescription: { contains: '35 euros' } },
    select: { id: true, title: true, slug: true, shortDescription: true },
  });

  console.log(`Total produits concernés : ${products.length}\n`);

  // 1) Texte complet de 3 exemples variés (début, milieu, fin de liste) pour voir le contexte entier.
  console.log('========== Exemples complets (non tronqués) ==========');
  const samples = [products[0], products[Math.floor(products.length / 2)], products[products.length - 1]].filter(Boolean);
  for (const p of samples) {
    console.log(`\n--- ${p.title} (/produit/${p.slug}) ---`);
    console.log(JSON.stringify(p.shortDescription));
  }

  // 2) Vérifie si LA PHRASE elle-même ("Envois gratuits dès 35 euros.") est identique partout, ou si
  // elle varie (majuscules, ponctuation, montant différent...). On regroupe par phrase exacte trouvée.
  console.log('\n\n========== Variantes exactes de la phrase "35 euros" trouvées ==========');
  const variants = new Map();
  for (const p of products) {
    const matches = p.shortDescription.match(TARGET_SENTENCE) || [];
    for (const m of matches) {
      variants.set(m, (variants.get(m) || 0) + 1);
    }
  }
  for (const [variant, count] of [...variants.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  "${variant}" → ${count} produit(s)`);
  }

  // 3) Combien de produits ont la phrase EXACTEMENT une fois (remplacement simple) vs plusieurs fois
  // ou 0 fois après le regex (cas particulier à vérifier à la main).
  let zero = 0, one = 0, many = 0;
  for (const p of products) {
    const n = (p.shortDescription.match(TARGET_SENTENCE) || []).length;
    if (n === 0) zero++;
    else if (n === 1) one++;
    else many++;
  }
  console.log(`\n0 occurrence (ne matche pas le regex) : ${zero}`);
  console.log(`1 occurrence (cas simple) : ${one}`);
  console.log(`plusieurs occurrences : ${many}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
