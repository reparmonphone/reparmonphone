// Suite de fix-duplicate-content-family-a.js : traite les 8 familles de contenu dupliqué restantes,
// détectées par scripts/inspect-conseils-garanties-blocks.js (~2160 fiches au total, sur les 5975 où le
// bloc "NOS CONSEILS...LES GARANTIES ReparMonPhone" a pu être extrait — les 3815 de la Famille A ont déjà
// été traitées séparément).
//
// Chaque famille est repérée par une empreinte de texte qui lui est propre (des phrases qui n'existent
// que dans cette famille-là), pour ne jamais mélanger les familles entre elles. Comme pour la Famille A,
// chaque fiche reçoit une des 3 formulations alternatives, choisie de façon déterministe selon son
// identifiant (même produit = toujours la même variante).
//
// Familles traitées ici :
//   B  — Vitre arrière/tactile avec conseil colle B7000 (empreinte : "colle B 7000" / "colle B7000")
//   B2 — Vitre arrière, version longue reformulée ("fortement recommandé de vérifier le modèle exact")
//   C  — Caméra, version courte ("il ne faut pas déposer la caméra")
//   C2 — Caméra, version longue reformulée ("évitez de poser la caméra")
//   D  — Châssis (vis / étanchéité) ("ne pas serrer les vis trop fort")
//   E  — Adhésif (un seul conseil, "tester la pièce remplacée en amont")
//   F  — Vitre cache caméra ("pincer, arracher ou endommager les éléments présents lors du démontage")
//   G  — Écran LCD/tactile ("test de l'écran (non monté) est impératif")
//
// Usage :
//   node scripts/fix-duplicate-content-families-b-to-g.js            (aperçu, aucune écriture)
//   node scripts/fix-duplicate-content-families-b-to-g.js --apply     (applique réellement)

require('dotenv').config({ path: require('path').join(__dirname, '../.env.migration') });
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');

const FAMILIES = [
  {
    key: 'B',
    label: 'Vitre + colle B7000',
    fingerprint: (d) => /colle\s*B\s*7000/i.test(d),
    variants: [
      `<strong>NOS CONSEILS</strong>
<ul>
  <li>Vérifiez le modèle exact de votre smartphone ou tablette à l'aide de sa référence avant l'achat.</li>
  <li>Manipulez les nappes situées autour de la vitre avec précaution, pour ne pas les pincer ni les déchirer.</li>
  <li>Pour une pose sans adhésif d'origine, utilisez une colle adaptée (colle B7000 110 ml ou 50 ml).</li>
</ul>
<strong>LES GARANTIES ReparMonPhone</strong>
<ul>
  <li>Chaque pièce est testée avant expédition, pour une durée de vie optimale.</li>
  <li>Garantie fonctionnelle, pour une réparation sans mauvaise surprise.</li>
  <li>Retours simples et rapides si besoin.</li>
</ul>`,
      `<strong>NOS CONSEILS</strong>
<ul>
  <li>Avant de commander, confirmez la référence exacte de votre appareil : plusieurs versions se ressemblent visuellement.</li>
  <li>Les nappes proches de la vitre sont fragiles — évitez de les tirer ou de les pincer pendant l'intervention.</li>
  <li>Si vous recollez sans l'adhésif d'origine, la colle B7000 (en 50 ml ou 110 ml) convient bien à cet usage.</li>
</ul>
<strong>LES GARANTIES ReparMonPhone</strong>
<ul>
  <li>Nos pièces sont contrôlées avant l'envoi pour garantir leur fiabilité.</li>
  <li>Fonctionnement garanti, pour repartir sereinement.</li>
  <li>Une politique de retour claire et sans complication.</li>
</ul>`,
      `<strong>NOS CONSEILS</strong>
<ul>
  <li>Repérez le modèle exact de votre smartphone ou tablette via sa référence plutôt que son nom commercial.</li>
  <li>Attention aux nappes qui longent la vitre : une manipulation trop brusque peut les endommager.</li>
  <li>Pas d'adhésif d'origine sous la main ? La colle B7000 (50 ml ou 110 ml) est une bonne alternative.</li>
</ul>
<strong>LES GARANTIES ReparMonPhone</strong>
<ul>
  <li>Toutes nos pièces sont testées avant expédition.</li>
  <li>Le bon fonctionnement est garanti pour chaque référence.</li>
  <li>Retour possible rapidement et sans démarche compliquée.</li>
</ul>`,
    ],
  },
  {
    key: 'B2',
    label: 'Vitre arrière (reformulé long)',
    fingerprint: (d) => /fortement recommandé de vérifier le modèle exact/i.test(d),
    variants: [
      `<strong>NOS CONSEILS</strong>
<ul>
  <li>Avant l'achat, vérifiez le modèle exact de votre smartphone ou tablette via sa référence : plusieurs versions se ressemblent et prêtent à confusion.</li>
  <li>Lors du démontage, manipulez la zone concernée avec précaution pour ne pas endommager les composants voisins.</li>
  <li>Avant la pose, assurez-vous que la surface soit propre, sèche et sans poussière, pour une fixation de qualité.</li>
  <li>Au remontage, prenez le temps de bien positionner la pièce pour un résultat homogène et durable.</li>
</ul>
<strong>LES GARANTIES ReparMonPhone</strong>
<ul>
  <li>Nos pièces sont testées avec soin pour offrir une qualité constante et une durée de vie optimale.</li>
  <li>Elles sont garanties fonctionnelles pour une réparation plus sereine.</li>
  <li>Vous bénéficiez d'une politique de retours souples et rapides.</li>
</ul>`,
      `<strong>NOS CONSEILS</strong>
<ul>
  <li>Identifiez la référence précise de votre appareil avant de commander — le nom commercial seul prête parfois à confusion entre plusieurs versions.</li>
  <li>Pendant le démontage, prenez garde aux éléments situés autour de la pièce pour ne rien abîmer.</li>
  <li>Nettoyez et asséchez bien la surface avant la pose, pour un meilleur maintien dans le temps.</li>
  <li>Positionnez soigneusement la pièce au remontage pour une finition nette.</li>
</ul>
<strong>LES GARANTIES ReparMonPhone</strong>
<ul>
  <li>Chaque pièce est testée avant expédition, pour une durée de vie optimale.</li>
  <li>Garantie fonctionnelle, pour une réparation sans mauvaise surprise.</li>
  <li>Retours simples et rapides si besoin.</li>
</ul>`,
      `<strong>NOS CONSEILS</strong>
<ul>
  <li>Vérifiez toujours le modèle exact de votre appareil par sa référence avant l'achat, certaines versions étant très similaires.</li>
  <li>Manipulez les éléments proches avec précaution lors du démontage, pour préserver les composants environnants.</li>
  <li>Une surface propre, sèche et sans résidu garantit une fixation nette au moment de la pose.</li>
  <li>Prenez le temps de bien aligner la pièce au remontage pour un rendu homogène.</li>
</ul>
<strong>LES GARANTIES ReparMonPhone</strong>
<ul>
  <li>Nos pièces sont contrôlées avant l'envoi pour garantir leur fiabilité.</li>
  <li>Fonctionnement garanti, pour repartir sereinement.</li>
  <li>Une politique de retour claire et sans complication.</li>
</ul>`,
    ],
  },
  {
    key: 'C',
    label: 'Caméra (version courte)',
    fingerprint: (d) => /il ne faut pas déposer la caméra/i.test(d),
    variants: [
      `<strong>NOS CONSEILS</strong>
<ul>
  <li>Ne posez jamais la caméra sur une surface aimantée : cela peut dérégler ses composants internes.</li>
  <li>Évitez de toucher directement l'objectif lors de la pose, pour ne pas y laisser de traces.</li>
</ul>
<strong>LES GARANTIES ReparMonPhone</strong>
<ul>
  <li>Chaque pièce est testée avant expédition, pour une durée de vie optimale.</li>
  <li>Garantie fonctionnelle, pour une réparation sans mauvaise surprise.</li>
  <li>Retours simples et rapides si besoin.</li>
</ul>`,
      `<strong>NOS CONSEILS</strong>
<ul>
  <li>Gardez la caméra à l'écart de toute surface aimantée, au risque de perturber son fonctionnement.</li>
  <li>Manipulez l'objectif avec des mains propres et évitez tout contact direct pendant l'installation.</li>
</ul>
<strong>LES GARANTIES ReparMonPhone</strong>
<ul>
  <li>Nos pièces sont contrôlées avant l'envoi pour garantir leur fiabilité.</li>
  <li>Fonctionnement garanti, pour repartir sereinement.</li>
  <li>Une politique de retour claire et sans complication.</li>
</ul>`,
      `<strong>NOS CONSEILS</strong>
<ul>
  <li>Une surface aimantée peut dérégler la caméra : évitez donc de l'y poser, même brièvement.</li>
  <li>Ne touchez pas l'objectif à main nue lors de la mise en place, pour préserver sa netteté.</li>
</ul>
<strong>LES GARANTIES ReparMonPhone</strong>
<ul>
  <li>Toutes nos pièces sont testées avant expédition.</li>
  <li>Le bon fonctionnement est garanti pour chaque référence.</li>
  <li>Retour possible rapidement et sans démarche compliquée.</li>
</ul>`,
    ],
  },
  {
    key: 'C2',
    label: 'Caméra (reformulé long)',
    fingerprint: (d) => /évitez de poser la caméra/i.test(d),
    variants: [
      `<strong>NOS CONSEILS</strong>
<ul>
  <li>Tenez la caméra éloignée de toute surface aimantée pendant la réparation, pour limiter les risques de dérèglement.</li>
  <li>Évitez de toucher directement l'objectif lors de la pose, afin de ne pas laisser de traces, poussières ou micro-rayures.</li>
  <li>Travaillez sur une surface propre et manipulez la pièce avec soin pour préserver sa qualité optique.</li>
  <li>Avant de refermer, vérifiez que la caméra est correctement positionnée.</li>
</ul>
<strong>LES GARANTIES ReparMonPhone</strong>
<ul>
  <li>Nos pièces sont testées avec soin pour offrir une qualité constante et une durée de vie optimale.</li>
  <li>Elles sont garanties fonctionnelles pour une réparation plus sereine.</li>
  <li>Vous bénéficiez d'une politique de retours souples et rapides.</li>
</ul>`,
      `<strong>NOS CONSEILS</strong>
<ul>
  <li>Une surface aimantée peut perturber le capteur : mieux vaut en tenir la caméra à l'écart durant toute l'intervention.</li>
  <li>Gardez les doigts loin de l'objectif au moment de l'installation pour éviter traces et micro-rayures.</li>
  <li>Un plan de travail propre limite le risque de poussière sur le composant.</li>
  <li>Contrôlez le bon alignement de la caméra avant le remontage final.</li>
</ul>
<strong>LES GARANTIES ReparMonPhone</strong>
<ul>
  <li>Chaque pièce est testée avant expédition, pour une durée de vie optimale.</li>
  <li>Garantie fonctionnelle, pour une réparation sans mauvaise surprise.</li>
  <li>Retours simples et rapides si besoin.</li>
</ul>`,
      `<strong>NOS CONSEILS</strong>
<ul>
  <li>Évitez tout contact entre la caméra et une surface aimantée, cela pourrait affecter son fonctionnement.</li>
  <li>Ne manipulez pas l'objectif à main nue pendant la pose, pour éviter poussières et micro-rayures.</li>
  <li>Installez-vous sur un plan de travail propre et dégagé pour préserver la qualité du composant.</li>
  <li>Vérifiez le positionnement final de la caméra avant de refermer l'appareil.</li>
</ul>
<strong>LES GARANTIES ReparMonPhone</strong>
<ul>
  <li>Nos pièces sont contrôlées avant l'envoi pour garantir leur fiabilité.</li>
  <li>Fonctionnement garanti, pour repartir sereinement.</li>
  <li>Une politique de retour claire et sans complication.</li>
</ul>`,
    ],
  },
  {
    key: 'D',
    label: 'Châssis (vis / étanchéité)',
    fingerprint: (d) => /ne pas serrer les vis trop fort/i.test(d),
    variants: [
      `<strong>NOS CONSEILS</strong>
<ul>
  <li>Avant la mise en place définitive, vérifiez bien la version de votre châssis (3G/4G, Simple/Double SIM...) : les emplacements internes varient.</li>
  <li>Ne serrez pas les vis trop fort, au risque d'endommager le pas de vis.</li>
  <li>Sur un appareil étanche, remplacer le châssis peut affecter l'étanchéité d'origine.</li>
</ul>
<strong>LES GARANTIES ReparMonPhone</strong>
<ul>
  <li>Chaque pièce est testée avant expédition, pour une durée de vie optimale.</li>
  <li>Garantie fonctionnelle, pour une réparation sans mauvaise surprise.</li>
  <li>Retours simples et rapides si besoin.</li>
</ul>`,
      `<strong>NOS CONSEILS</strong>
<ul>
  <li>Confirmez la variante exacte de votre châssis avant l'installation (3G/4G, Simple/Double SIM...), les emplacements internes n'étant pas toujours identiques.</li>
  <li>Un serrage trop appuyé des vis peut abîmer le filetage : allez-y progressivement.</li>
  <li>Pour les modèles étanches, gardez en tête que le changement de châssis peut réduire cette étanchéité.</li>
</ul>
<strong>LES GARANTIES ReparMonPhone</strong>
<ul>
  <li>Nos pièces sont contrôlées avant l'envoi pour garantir leur fiabilité.</li>
  <li>Fonctionnement garanti, pour repartir sereinement.</li>
  <li>Une politique de retour claire et sans complication.</li>
</ul>`,
      `<strong>NOS CONSEILS</strong>
<ul>
  <li>Vérifiez la version précise de votre châssis (3G/4G, Simple/Double SIM...) avant de commencer, les emplacements pouvant différer d'une variante à l'autre.</li>
  <li>Serrez les vis avec mesure : un serrage excessif use ou casse le pas de vis.</li>
  <li>Sur les appareils étanches, sachez que remplacer le châssis peut ne pas préserver totalement l'étanchéité d'origine.</li>
</ul>
<strong>LES GARANTIES ReparMonPhone</strong>
<ul>
  <li>Toutes nos pièces sont testées avant expédition.</li>
  <li>Le bon fonctionnement est garanti pour chaque référence.</li>
  <li>Retour possible rapidement et sans démarche compliquée.</li>
</ul>`,
    ],
  },
  {
    key: 'E',
    label: 'Adhésif',
    fingerprint: (d) => /tester la pièce remplacée en amont/i.test(d),
    variants: [
      `<strong>NOS CONSEILS</strong>
<ul>
  <li>Avant de poser l'adhésif, testez toujours la pièce (écran ou vitre) sans la coller, pour écarter tout problème en amont.</li>
</ul>
<strong>LES GARANTIES ReparMonPhone</strong>
<ul>
  <li>Chaque pièce est testée avant expédition, pour une durée de vie optimale.</li>
  <li>Garantie fonctionnelle, pour une réparation sans mauvaise surprise.</li>
  <li>Retours simples et rapides si besoin.</li>
</ul>`,
      `<strong>NOS CONSEILS</strong>
<ul>
  <li>Faites un essai à blanc de la pièce remplacée avant d'appliquer l'adhésif définitif — cela évite bien des mauvaises surprises.</li>
</ul>
<strong>LES GARANTIES ReparMonPhone</strong>
<ul>
  <li>Nos pièces sont contrôlées avant l'envoi pour garantir leur fiabilité.</li>
  <li>Fonctionnement garanti, pour repartir sereinement.</li>
  <li>Une politique de retour claire et sans complication.</li>
</ul>`,
      `<strong>NOS CONSEILS</strong>
<ul>
  <li>Avant de coller définitivement l'écran ou la vitre, vérifiez que tout fonctionne correctement en la testant sans adhésif.</li>
</ul>
<strong>LES GARANTIES ReparMonPhone</strong>
<ul>
  <li>Toutes nos pièces sont testées avant expédition.</li>
  <li>Le bon fonctionnement est garanti pour chaque référence.</li>
  <li>Retour possible rapidement et sans démarche compliquée.</li>
</ul>`,
    ],
  },
  {
    key: 'F',
    label: 'Vitre cache caméra',
    fingerprint: (d) => /pincer, arracher ou endommager les éléments présents lors du démontage/i.test(d),
    variants: [
      `<strong>NOS CONSEILS</strong>
<ul>
  <li>Vérifiez le modèle exact de votre smartphone ou tablette par sa référence, plutôt que par son seul nom commercial.</li>
  <li>Lors du démontage, manipulez la zone autour de la vitre cache caméra avec précaution, pour ne rien pincer ni arracher.</li>
  <li>Avant la pose, assurez-vous que la surface est propre, sèche et sans poussière, pour une bonne adhérence.</li>
  <li>Prenez le temps de bien positionner la pièce au remontage, pour un résultat net et durable.</li>
</ul>
<strong>LES GARANTIES ReparMonPhone</strong>
<ul>
  <li>Chaque pièce est testée avant expédition, pour une durée de vie optimale.</li>
  <li>Garantie fonctionnelle, pour une réparation sans mauvaise surprise.</li>
  <li>Retours simples et rapides si besoin.</li>
</ul>`,
      `<strong>NOS CONSEILS</strong>
<ul>
  <li>Avant l'achat, identifiez la référence précise de votre appareil : plusieurs modèles se ressemblent.</li>
  <li>Autour de la vitre cache caméra, procédez avec douceur au démontage pour ne rien endommager.</li>
  <li>Nettoyez et séchez bien la surface avant de fixer la nouvelle pièce.</li>
  <li>Au remontage, ajustez soigneusement la position pour un rendu homogène.</li>
</ul>
<strong>LES GARANTIES ReparMonPhone</strong>
<ul>
  <li>Nos pièces sont contrôlées avant l'envoi pour garantir leur fiabilité.</li>
  <li>Fonctionnement garanti, pour repartir sereinement.</li>
  <li>Une politique de retour claire et sans complication.</li>
</ul>`,
      `<strong>NOS CONSEILS</strong>
<ul>
  <li>Confirmez le modèle exact de votre appareil via sa référence avant de passer commande.</li>
  <li>Les éléments proches de la vitre cache caméra sont fragiles : évitez de les pincer ou de les arracher au démontage.</li>
  <li>Une surface propre et sèche avant la pose garantit une meilleure tenue dans le temps.</li>
  <li>Positionnez soigneusement la pièce lors du remontage pour un résultat homogène.</li>
</ul>
<strong>LES GARANTIES ReparMonPhone</strong>
<ul>
  <li>Toutes nos pièces sont testées avant expédition.</li>
  <li>Le bon fonctionnement est garanti pour chaque référence.</li>
  <li>Retour possible rapidement et sans démarche compliquée.</li>
</ul>`,
    ],
  },
  {
    key: 'G',
    label: 'Écran (test non monté)',
    fingerprint: (d) => /test de l'écran \(non monté\) est impératif/i.test(d),
    variants: [
      `<strong>NOS CONSEILS</strong>
<ul>
  <li>Vérifiez le modèle exact de votre smartphone ou tablette par sa référence, plutôt que par son nom commercial.</li>
  <li>Avant toute réparation, testez l'écran sans le fixer : cela permet d'écarter un éventuel défaut de la pièce elle-même.</li>
  <li>Manipulez les nappes de l'écran avec précaution, pour ne pas les pincer ni les déchirer.</li>
  <li>Si vous fixez un écran simple sur son châssis d'origine, nettoyez bien ce dernier au préalable : poussières et débris nuisent à la fixation.</li>
</ul>
<strong>LES GARANTIES ReparMonPhone</strong>
<ul>
  <li>Chaque pièce est testée avant expédition, pour une durée de vie optimale.</li>
  <li>Garantie fonctionnelle, pour une réparation sans mauvaise surprise.</li>
  <li>Retours simples et rapides si besoin.</li>
</ul>`,
      `<strong>NOS CONSEILS</strong>
<ul>
  <li>Identifiez la référence exacte de votre appareil avant l'achat, plutôt que de vous fier à son seul nom commercial.</li>
  <li>Un test de l'écran avant montage définitif permet de repérer un éventuel souci avant l'installation complète.</li>
  <li>Les nappes de l'écran sont fragiles : évitez de les pincer ou de les tirer pendant la manipulation.</li>
  <li>Pour un écran simple posé sur son châssis d'origine, un nettoyage préalable évite que poussières et débris ne gênent la fixation.</li>
</ul>
<strong>LES GARANTIES ReparMonPhone</strong>
<ul>
  <li>Nos pièces sont contrôlées avant l'envoi pour garantir leur fiabilité.</li>
  <li>Fonctionnement garanti, pour repartir sereinement.</li>
  <li>Une politique de retour claire et sans complication.</li>
</ul>`,
      `<strong>NOS CONSEILS</strong>
<ul>
  <li>Repérez le modèle exact de votre appareil via sa référence avant de commander.</li>
  <li>Faites un essai de l'écran sans le fixer avant la réparation définitive, pour prévenir tout problème lié à la pièce.</li>
  <li>Ne pincez ni ne déchirez les nappes de l'écran lors de la manipulation.</li>
  <li>Avant de fixer un écran simple sur son châssis, nettoyez soigneusement ce dernier pour une bonne adhérence.</li>
</ul>
<strong>LES GARANTIES ReparMonPhone</strong>
<ul>
  <li>Toutes nos pièces sont testées avant expédition.</li>
  <li>Le bon fonctionnement est garanti pour chaque référence.</li>
  <li>Retour possible rapidement et sans démarche compliquée.</li>
</ul>`,
    ],
  },
];

function pickVariant(productId, n) {
  const hash = crypto.createHash('md5').update(productId).digest();
  return hash[0] % n;
}

// Même logique d'extraction/nettoyage que fix-duplicate-content-family-a.js
function extractBlock(desc) {
  const startMatch = desc.match(/(<strong>)?NOS CONSEILS(<\/strong>)?/i);
  if (!startMatch) return null;
  const startIdx = startMatch.index;
  const rest = desc.slice(startIdx);
  const endMatch = rest.match(/retours souples et rapides[\s.]*(?:<\/[a-zA-Z0-9]+>[\s.]*)*/i);
  if (!endMatch) return null;
  const endIdx = startIdx + endMatch.index + endMatch[0].length;
  return { start: startIdx, end: endIdx };
}

function hasTrailingDebris(after, insertEndIdx) {
  const next = after.slice(insertEndIdx, insertEndIdx + 40);
  return /^\s*\.?\s*<\/[a-zA-Z0-9]+>/.test(next);
}

async function main() {
  const products = await prisma.product.findMany({
    where: { description: { contains: 'NOS CONSEILS' } },
    select: { id: true, slug: true, title: true, pieceType: true, description: true },
  });
  console.log(`Fiches contenant "NOS CONSEILS" (toutes familles confondues) : ${products.length}`);

  const remaining = [...products];
  const allChanges = [];
  let totalDebris = 0;
  const debrisExamples = [];
  const multiMatchWarnings = [];

  for (const family of FAMILIES) {
    const matched = remaining.filter((p) => family.fingerprint(p.description));
    // Alerte si une fiche correspond à plusieurs familles (ne devrait jamais arriver vu les empreintes choisies).
    const otherMatches = matched.filter((p) => FAMILIES.some((f) => f !== family && f.fingerprint(p.description)));
    if (otherMatches.length > 0) multiMatchWarnings.push(...otherMatches.map((p) => `${p.slug} [${family.key}]`));

    const familyChanges = [];
    const variantCounts = Array(family.variants.length).fill(0);
    let skipped = 0;
    for (const p of matched) {
      const block = extractBlock(p.description);
      if (!block) {
        skipped++;
        continue;
      }
      const variantIdx = pickVariant(p.id, family.variants.length);
      variantCounts[variantIdx]++;
      const chosen = family.variants[variantIdx];
      const insertEndIdx = block.start + chosen.length;
      const after = p.description.slice(0, block.start) + chosen + p.description.slice(block.end);
      if (hasTrailingDebris(after, insertEndIdx)) {
        totalDebris++;
        if (debrisExamples.length < 5) debrisExamples.push({ p, after, insertEndIdx, family: family.key });
      }
      familyChanges.push({ p, after, variantIdx });
    }

    console.log(
      `\nFamille ${family.key} (${family.label}) : ${matched.length} fiches repérées, ${familyChanges.length} remplaçables` +
        (skipped ? `, ${skipped} non extraites` : '') +
        ` — répartition : ${variantCounts.map((c, i) => `#${i + 1}: ${c}`).join('  ')}`
    );

    allChanges.push(...familyChanges);
    // On retire ces fiches du pool restant pour ne pas les recompter dans une autre famille.
    const matchedIds = new Set(matched.map((p) => p.id));
    for (let i = remaining.length - 1; i >= 0; i--) {
      if (matchedIds.has(remaining[i].id)) remaining.splice(i, 1);
    }
  }

  console.log(`\n========== Total ==========`);
  console.log(`Fiches modifiées au total : ${allChanges.length}`);
  console.log(`Fiches avec "NOS CONSEILS" non couvertes par une famille connue (déjà traitées en Famille A, ou format à examiner) : ${remaining.length}`);
  console.log(`Débris détectés après remplacement : ${totalDebris}`);
  if (multiMatchWarnings.length > 0) {
    console.log(`⚠️  Fiches correspondant à plusieurs familles à la fois (à vérifier manuellement) : ${multiMatchWarnings.join(', ')}`);
  }

  if (debrisExamples.length > 0) {
    console.log('\n========== Exemples AVEC débris ==========');
    for (const { p, after, insertEndIdx, family } of debrisExamples) {
      console.log(`\n--- [${family}] ${p.title} (/produit/${p.slug}) ---`);
      console.log('Ce qui suit immédiatement le bloc inséré :', JSON.stringify(after.slice(insertEndIdx, insertEndIdx + 60)));
    }
  }

  console.log('\n========== Aperçu (1 exemple par famille) ==========');
  for (const family of FAMILIES) {
    const example = allChanges.find(({ p }) => family.fingerprint(p.description));
    if (!example) continue;
    console.log(`\n--- [${family.key}] ${example.p.title} (/produit/${example.p.slug}) — variante #${example.variantIdx + 1} ---`);
    console.log(example.after.length > 1200 ? example.after.slice(0, 1200) + '...[tronqué]' : example.after);
  }

  if (!APPLY) {
    console.log(`\nAperçu uniquement — relance avec --apply pour appliquer réellement sur les ${allChanges.length} produits.`);
    return;
  }

  let updated = 0;
  for (const { p, after } of allChanges) {
    await prisma.product.update({ where: { id: p.id }, data: { description: after } });
    updated++;
  }
  console.log(`\n✅ ${updated} produit(s) mis à jour.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
