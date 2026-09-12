// Retire la mention "Comptes professionnels." du texte fournisseur (même boilerplate que "Envois
// gratuits dès 35 euros.", déjà corrigé par fix-35-euros-boilerplate.js) trouvée dans
// Product.shortDescription. D'abord une vérification des variantes exactes (ponctuation, espaces),
// puis un aperçu avant/après, puis application avec --apply — même principe que les scripts précédents.
//
// Usage :
//   node scripts/remove-professional-accounts-mention.js            (vérif + aperçu, aucune écriture)
//   node scripts/remove-professional-accounts-mention.js --apply     (applique réellement)

require('dotenv').config({ path: require('path').join(__dirname, '../.env.migration') });
const { PrismaClient, Prisma } = require('@prisma/client');
const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');

// On cherche la phrase précédée d'un espace, avec ou sans espace(s) qui traîneraient après — pour être
// sûr de ne pas laisser un double espace ou un espace final une fois la phrase retirée.
const RE_MENTION = / ?Comptes professionnels\.?\s*/g;

async function main() {
  const affected = await prisma.product.findMany({
    where: { shortDescription: { contains: 'Comptes professionnels' } },
    select: { id: true, title: true, slug: true, shortDescription: true },
  });

  console.log(`Produits concernés : ${affected.length}`);

  // 1) Variantes exactes trouvées (pour vérifier qu'il n'y a pas de surprise de ponctuation/espacement)
  console.log('\n========== Variantes exactes trouvées ==========');
  const variants = new Map();
  for (const p of affected) {
    const matches = p.shortDescription.match(RE_MENTION) || [];
    for (const m of matches) {
      variants.set(JSON.stringify(m), (variants.get(JSON.stringify(m)) || 0) + 1);
    }
  }
  for (const [variant, count] of [...variants.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${variant} → ${count} produit(s)`);
  }

  // 2) Combien de produits ont la mention en toute fin de texte (cas simple) vs ailleurs au milieu
  // (à vérifier à la main si jamais ça arrive).
  let atEnd = 0, notAtEnd = 0;
  for (const p of affected) {
    const idx = p.shortDescription.search(RE_MENTION);
    const trimmedLength = p.shortDescription.trimEnd().length;
    const isAtEnd = idx !== -1 && (p.shortDescription.slice(idx).match(RE_MENTION) || [''])[0].length + idx >= trimmedLength - 1;
    if (isAtEnd) atEnd++;
    else notAtEnd++;
  }
  console.log(`\nEn toute fin de description : ${atEnd}`);
  console.log(`Ailleurs (à vérifier) : ${notAtEnd}`);

  // 3) Aperçu avant/après sur 3 exemples
  console.log('\n========== Aperçu (3 exemples) ==========');
  for (const p of affected.slice(0, 3)) {
    const after = p.shortDescription.replace(RE_MENTION, '').trimEnd();
    console.log(`\n${p.title} (/produit/${p.slug})`);
    console.log('  Avant :', p.shortDescription);
    console.log('  Après :', after);
  }

  if (!APPLY) {
    console.log(`\nAperçu uniquement — relance avec --apply pour appliquer réellement sur les ${affected.length} produits.`);
    return;
  }

  let updated = 0;
  // Mise à jour ligne par ligne (et non un seul REPLACE SQL comme pour "35 euros") car ici on doit
  // aussi retirer l'espace qui précède la phrase, ce que REPLACE seul gère moins proprement en SQL brut.
  for (const p of affected) {
    const after = p.shortDescription.replace(RE_MENTION, '').trimEnd();
    if (after === p.shortDescription) continue;
    await prisma.product.update({ where: { id: p.id }, data: { shortDescription: after } });
    updated++;
  }
  console.log(`\n✅ ${updated} produit(s) mis à jour.`);

  const stillLeft = await prisma.product.count({ where: { shortDescription: { contains: 'Comptes professionnels' } } });
  console.log(`Vérification : ${stillLeft} produit(s) contiennent encore la mention (devrait être 0).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
