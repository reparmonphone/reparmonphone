// Corrige les mentions de l'ancien fournisseur "Pieces2Mobile" trouvées dans Product.description
// (38 produits, 45 mentions — voir find-pieces2mobile-mentions.js). Trois cas différents :
//
//  1) Le lien vers la colle B7000 (<a href="https://www.pieces2mobile.com/colle-b7000-...">) —
//     remplacé par le lien vers la vraie fiche équivalente chez Krys (demande explicite du 12/09/2026),
//     texte visible du lien conservé tel quel.
//  2) Les AUTRES vrais liens hypertexte vers pieces2mobile.com (ex: <a href="https://www.pieces2mobile.com/...">
//     regardez</a>) — pas d'équivalent connu chez Krys, donc on ne peut pas juste remplacer le nom dans
//     l'URL (ça donnerait un lien mort). On retire le lien et on garde uniquement le texte visible.
//  3) Mentions en texte simple ("PIECES2MOBILE", "Pieces2Mobile.com", "Pieces2Mobile") — remplacées
//     directement par "ReparMonPhone".
//
// Usage :
//   node scripts/fix-pieces2mobile-mentions.js            (aperçu, aucune écriture)
//   node scripts/fix-pieces2mobile-mentions.js --apply     (applique réellement)

require('dotenv').config({ path: require('path').join(__dirname, '../.env.migration') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');

const COLLE_B7000_URL = 'https://www.reparmonphone.fr/produit/colle-b7000-50ml-smartphones-et-tablettes-mechanic';

// Repère chaque lien <a ...href="...pieces2mobile.com...">texte</a> et capture séparément les attributs
// avant/après href (pour les garder tels quels, ex: target="_blank" rel="noopener"). Les URL ne
// contiennent pas d'accent, donc pas besoin de gérer "pièces2mobile" ici.
const ANCHOR_RE = /<a\s+([^>]*?)href\s*=\s*"([^"]*pieces2mobile\.com[^"]*)"([^>]*)>([\s\S]*?)<\/a>/gi;
// Remplace toute mention restante en texte simple par "ReparMonPhone" — casse variable, avec ou sans
// ".com", ET avec ou sans l'accent sur le "è" de "pièces" (les deux orthographes existent dans les
// textes importés : "PIECES2MOBILE" et "PIÈCES2MOBILE" — le [eèEÈ] explicite couvre les deux sans
// dépendre du comportement du moteur regex sur les accents).
const BRAND_RE = /pi[eèEÈ]ces2mobile(\.com)?/gi;

function fixAnchors(text) {
  return text.replace(ANCHOR_RE, (full, preAttrs, href, postAttrs, inner) => {
    if (/colle-b7000/i.test(href)) {
      return `<a ${preAttrs}href="${COLLE_B7000_URL}"${postAttrs}>${inner}</a>`;
    }
    // Pas d'équivalent connu chez Krys pour ce lien : on retire le lien, on garde le texte visible.
    return inner;
  });
}

function fixText(text) {
  if (!text) return text;
  let result = fixAnchors(text);
  result = result.replace(BRAND_RE, 'ReparMonPhone');
  return result;
}

async function main() {
  const products = await prisma.product.findMany({
    where: {
      OR: [
        { description: { contains: 'ieces2mobile', mode: 'insensitive' } },
        { description: { contains: 'ièces2mobile', mode: 'insensitive' } },
      ],
    },
    select: { id: true, slug: true, title: true, description: true },
  });

  console.log(`Produits concernés : ${products.length}`);

  let linksRedirected = 0;
  let linksRemoved = 0;
  let brandReplacements = 0;
  const changes = [];
  for (const p of products) {
    const anchors = [...p.description.matchAll(ANCHOR_RE)];
    for (const a of anchors) {
      if (/colle-b7000/i.test(a[2])) linksRedirected++;
      else linksRemoved++;
    }
    const after = fixText(p.description);
    const remainingBrandMentions = (p.description.replace(ANCHOR_RE, '').match(BRAND_RE) || []).length;
    brandReplacements += remainingBrandMentions;
    if (after !== p.description) changes.push({ p, after });
  }

  console.log(`Liens colle B7000 redirigés vers ta propre fiche produit : ${linksRedirected}`);
  console.log(`Autres liens vers pieces2mobile.com retirés (texte conservé, lien supprimé) : ${linksRemoved}`);
  console.log(`Mentions texte remplacées par "ReparMonPhone" : ${brandReplacements}`);

  console.log('\n========== Aperçu (tous les changements, extrait autour de chaque mention) ==========');
  for (const { p, after } of changes) {
    console.log(`\n--- ${p.title} (/produit/${p.slug}) ---`);
    // Affiche un extrait autour de chaque endroit modifié plutôt que tout le HTML (souvent long).
    const before = p.description;
    // Repère chaque mention "pieces2mobile" / "pièces2mobile" (accentuée ou non) dans le texte
    // original pour afficher un extrait de contexte autour.
    const previewRe = /pi[eèEÈ]ces2mobile(\.com)?/gi;
    let m;
    while ((m = previewRe.exec(before)) !== null) {
      const start = Math.max(0, m.index - 70);
      const end = Math.min(before.length, m.index + m[0].length + 70);
      console.log('  Avant :', '...' + before.slice(start, end).replace(/\s+/g, ' ').trim() + '...');
    }
    console.log('  Après (description complète) :', after.length > 400 ? after.slice(0, 400) + '... [tronqué]' : after);
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

  const stillLeft = await prisma.product.count({
    where: {
      OR: [
        { description: { contains: 'ieces2mobile', mode: 'insensitive' } },
        { description: { contains: 'ièces2mobile', mode: 'insensitive' } },
      ],
    },
  });
  console.log(`Vérification : ${stillLeft} produit(s) contiennent encore une mention (devrait être 0).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
