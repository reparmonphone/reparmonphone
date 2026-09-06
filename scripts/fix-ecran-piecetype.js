/**
 * Diagnostique (et corrige, avec --apply) les produits dont le TITRE indique clairement un écran
 * ("Écran ...") mais dont le champ pieceType est resté "AUTRE" au lieu de "ECRAN" — un problème de
 * classification hérité du catalogue d'origine, découvert parce qu'il empêchait
 * src/lib/screenProtectorSuggestion.ts de proposer un verre trempé (cette fonction se base sur
 * pieceType === 'ECRAN', jamais sur le titre).
 *
 * Ce mauvais classement a un impact plus large que la seule suggestion de verre trempé : le filtre
 * "Écran" de la boutique (src/components/Filters.tsx, ?type=ECRAN) ne remonte pas non plus ces
 * produits.
 *
 * Sécurités appliquées :
 *  - Ne touche QUE les produits actuellement classés "AUTRE" (jamais un produit déjà classé dans un
 *    autre type de pièce précis comme BATTERIE ou CAMERA).
 *  - Exclut tout titre contenant "protection", "verre tremp", "film", "housse" ou "coque" — les
 *    vrais accessoires de protection d'écran, qui doivent rester hors du type ECRAN.
 *  - Exclut la marque "Accessoires" par sécurité supplémentaire (les écrans de remplacement
 *    appartiennent toujours à Apple/Samsung/Huawei/Xiaomi/Autre, jamais à "Accessoires").
 *
 * MODE APERÇU (par défaut, aucune écriture) :
 *   node scripts/fix-ecran-piecetype.js
 *
 * MODE RÉEL :
 *   node scripts/fix-ecran-piecetype.js --apply
 */

const path = require('path');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: path.join(__dirname, '../.env.migration') });

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

const EXCLUDE_RE = /(protection|verre\s*tremp|film|housse|coque)/i;

async function main() {
  console.log(APPLY ? 'MODE REEL - la base va etre modifiee.\n' : 'MODE APERCU - aucune ecriture ne sera faite.\n');

  const accessoiresBrand = await prisma.brand.findFirst({ where: { name: 'Accessoires' } });

  const candidates = await prisma.product.findMany({
    where: {
      pieceType: 'AUTRE',
      title: { contains: 'écran', mode: 'insensitive' },
      ...(accessoiresBrand
        ? { NOT: { model: { productLine: { brandId: accessoiresBrand.id } } } }
        : {}),
    },
    include: { model: { include: { productLine: { include: { brand: true } } } } },
  });

  const excluded = candidates.filter((p) => EXCLUDE_RE.test(p.title));
  const toFix = candidates.filter((p) => !EXCLUDE_RE.test(p.title));

  console.log(`${candidates.length} produit(s) actuellement "AUTRE" avec "écran" dans le titre (hors marque Accessoires).\n`);

  console.log(`${excluded.length} exclu(s) par sécurité (mot "protection/verre trempé/film/housse/coque" dans le titre) :`);
  excluded.slice(0, 10).forEach((p) => console.log(`   - "${p.title}"`));
  if (excluded.length > 10) console.log(`   ... et ${excluded.length - 10} autre(s)`);

  console.log(`\n${toFix.length} produit(s) seraient reclassés en pieceType=ECRAN :\n`);
  toFix.slice(0, 20).forEach((p) =>
    console.log(`   - "${p.title}" (marque: ${p.model.productLine.brand.name})`)
  );
  if (toFix.length > 20) console.log(`   ... et ${toFix.length - 20} autre(s)`);

  if (!APPLY) {
    console.log('\nAperçu uniquement — relance avec --apply pour appliquer réellement cette correction.');
    await prisma.$disconnect();
    return;
  }

  for (const p of toFix) {
    await prisma.product.update({ where: { id: p.id }, data: { pieceType: 'ECRAN' } });
  }

  console.log(`\n✅ ${toFix.length} produit(s) reclassé(s) en pieceType=ECRAN.`);
  console.log('Terminé.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
