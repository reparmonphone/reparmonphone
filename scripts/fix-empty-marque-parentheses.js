// Nettoie un artefact laissé dans Product.description : "de marque ReparMonPhone    () pour..."
// — une parenthèse vide (avec des espaces en trop autour) qui traîne après le nom de la marque.
// Origine probable : un modèle de texte du type "de marque {{marque}} ({{sous-marque}})" où la
// deuxième variable n'a jamais été renseignée lors de la génération des fiches batteries Ti-DIAG
// (15 produits trouvés dans scripts/Iphone.csv avec exactement ce trou). Comme on ne sait pas ce qui
// devait réellement figurer entre parenthèses, on ne devine rien : on retire juste "()" et on
// nettoie les espaces en trop autour, pour retomber sur une phrase propre ("de marque ReparMonPhone
// pour iPhone 13...").
//
// Usage :
//   node scripts/fix-empty-marque-parentheses.js            (aperçu, aucune écriture)
//   node scripts/fix-empty-marque-parentheses.js --apply     (applique réellement)

require('dotenv').config({ path: require('path').join(__dirname, '../.env.migration') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');

// Capture "marque <UnMot>" suivi d'une parenthèse vide (avec espaces variables avant/après) — le nom
// de marque n'est pas fixé à "ReparMonPhone" pour rester robuste si le même trou existe ailleurs
// avec un autre mot.
const RE = /(\bmarque\s+\S+)\s*\(\)\s*/gi;

function fixText(text) {
  if (!text) return text;
  return text.replace(RE, '$1 ');
}

async function main() {
  const products = await prisma.product.findMany({
    where: { description: { contains: '()' } },
    select: { id: true, slug: true, title: true, description: true },
  });

  const changes = [];
  for (const p of products) {
    const after = fixText(p.description);
    if (after !== p.description) changes.push({ p, after });
  }

  console.log(`Produits concernés : ${changes.length}`);

  console.log('\n========== Aperçu (extrait avant/après chaque parenthèse vide) ==========');
  for (const { p, after } of changes) {
    console.log(`\n--- ${p.title} (/produit/${p.slug}) ---`);
    const before = p.description;
    RE.lastIndex = 0;
    let m;
    while ((m = RE.exec(before)) !== null) {
      const start = Math.max(0, m.index - 60);
      const end = Math.min(before.length, m.index + m[0].length + 40);
      console.log('  Avant :', '...' + before.slice(start, end).replace(/\s+/g, ' ').trim() + '...');

      // Retrouve le même passage dans le texte corrigé (juste après "marque X ") pour montrer le résultat.
      const anchor = m[1] + ' ';
      const afterIdx = after.indexOf(anchor, Math.max(0, start - 5));
      if (afterIdx !== -1) {
        const aStart = Math.max(0, afterIdx - 40);
        const aEnd = Math.min(after.length, afterIdx + anchor.length + 40);
        console.log('  Après :', '...' + after.slice(aStart, aEnd).replace(/\s+/g, ' ').trim() + '...');
      }
    }
  }

  if (!APPLY) {
    console.log(`\nAperçu uniquement — relance avec --apply pour appliquer réellement sur les ${changes.length} produits.`);
    return;
  }

  let updated = 0;
  for (const { p, after } of changes) {
    await prisma.product.update({ where: { id: p.id }, data: { description: after } });
    updated++;
  }
  console.log(`\n✅ ${updated} produit(s) mis à jour.`);

  const stillLeft = await prisma.product.count({ where: { description: { contains: '()' } } });
  console.log(`Vérification (recherche large "()") : ${stillLeft} produit(s) contiennent encore une parenthèse vide quelque part (peut inclure des faux positifs sans rapport avec "marque").`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
