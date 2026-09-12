// Corrige le contenu dupliqué le plus massif détecté sur le site : le bloc générique
// "NOS CONSEILS / LES GARANTIES ReparMonPhone" (4 conseils sur la référence/versions/nappes/soudure +
// 3 garanties) qui revient QUASIMENT À L'IDENTIQUE sur environ 3800 fiches produits (nappes, connecteurs,
// boutons, haut-parleurs, vibreurs, mais aussi une bonne partie du fourre-tout "AUTRE" et "ACCESSOIRE") —
// voir scripts/inspect-conseils-garanties-blocks.js pour le détail des variantes trouvées.
//
// Comme pour les intros de région sur les pages villes (REGION_INTRO dans
// src/app/livraison/[ville]/page.tsx), on remplace ce bloc par 4 formulations différentes qui disent
// la même chose avec des mots différents, réparties de façon déterministe selon l'identifiant du
// produit (le même produit garde toujours la même variante d'une exécution à l'autre).
//
// Repérage des fiches concernées : on ne touche QUE les descriptions qui contiennent le bloc précis
// (empreinte : "NOS CONSEILS" + "SIM / SD" + "pincer" + "nappes" + "soudure" tous présents), ce qui
// exclut sans ambiguïté les autres familles de contenu dupliqué (vitres, caméras, châssis, adhésifs —
// celles-là seront traitées dans un prochain script séparé).
//
// Le rendu de product.description passe par dangerouslySetInnerHTML (vérifié dans
// src/app/produit/[slug]/page.tsx) : les balises HTML sont donc bien interprétées. Beaucoup des fiches
// concernées n'avaient AUCUNE balise (texte brut tout collé, sans puces) — elles gagnent donc aussi en
// lisibilité avec ce correctif, pas seulement en unicité de contenu.
//
// Usage :
//   node scripts/fix-duplicate-content-family-a.js            (aperçu, aucune écriture)
//   node scripts/fix-duplicate-content-family-a.js --apply     (applique réellement)

require('dotenv').config({ path: require('path').join(__dirname, '../.env.migration') });
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');

// ---- 4 variantes du bloc, même contenu/conseils, formulations différentes ----
const VARIANTS = [
  `<strong>NOS CONSEILS</strong>
<ul>
  <li>Avant l'achat, vérifiez le modèle exact de votre smartphone ou de votre tablette à l'aide de sa référence plutôt que de son seul nom commercial.</li>
  <li>Certaines versions se ressemblent : soyez attentif aux confusions possibles (SIM / SD, Power / Volume...).</li>
  <li>Manipulez les nappes avec précaution lors du remplacement, pour éviter de les pincer ou de les déchirer.</li>
  <li>Certaines pièces demandent un peu de dextérité, voire du matériel de soudure : prenez votre temps.</li>
</ul>
<strong>LES GARANTIES ReparMonPhone</strong>
<ul>
  <li>Chaque pièce est testée avant expédition, pour une durée de vie optimale.</li>
  <li>Garantie fonctionnelle, pour une réparation sans mauvaise surprise.</li>
  <li>Retours simples et rapides si besoin.</li>
</ul>`,

  `<strong>NOS CONSEILS</strong>
<ul>
  <li>Identifiez précisément votre modèle grâce à sa référence technique, plutôt qu'à son nom commercial : plusieurs versions portent parfois la même appellation.</li>
  <li>Vérifiez la variante exacte de votre appareil (SIM / SD, Power / Volume...) avant de commander, pour éviter toute confusion.</li>
  <li>Lors de l'installation, prenez soin des nappes : elles se pincent et se déchirent facilement.</li>
  <li>Certaines réparations nécessitent un peu d'expérience ou du matériel de soudure. En cas de doute, on est là pour vous conseiller.</li>
</ul>
<strong>LES GARANTIES ReparMonPhone</strong>
<ul>
  <li>Nos pièces sont contrôlées avant l'envoi pour garantir leur fiabilité.</li>
  <li>Fonctionnement garanti, pour repartir sereinement.</li>
  <li>Une politique de retour claire et sans complication.</li>
</ul>`,

  `<strong>NOS CONSEILS</strong>
<ul>
  <li>Repérez la référence exacte de votre appareil avant l'achat : le nom commercial seul prête souvent à confusion entre plusieurs versions.</li>
  <li>Attention aux variantes proches (SIM / SD, Power / Volume) qui changent les spécificités de la pièce.</li>
  <li>Les nappes sont fragiles : évitez de les pincer, de les tirer ou de les tordre pendant l'opération.</li>
  <li>Certaines interventions demandent un savoir-faire technique (soudure) — n'hésitez pas à nous solliciter si besoin.</li>
</ul>
<strong>LES GARANTIES ReparMonPhone</strong>
<ul>
  <li>Toutes nos pièces sont testées avant expédition.</li>
  <li>Le bon fonctionnement est garanti pour chaque référence.</li>
  <li>Retour possible rapidement et sans démarche compliquée.</li>
</ul>`,

  `<strong>NOS CONSEILS</strong>
<ul>
  <li>Avant de commander, confirmez le modèle exact de votre smartphone ou tablette via sa référence — le nom commercial seul ne suffit pas toujours.</li>
  <li>Plusieurs versions d'un même modèle existent parfois (SIM / SD, Power / Volume...) : vérifiez bien laquelle correspond à votre appareil.</li>
  <li>Pendant le remplacement, manipulez les nappes en douceur pour ne pas les abîmer.</li>
  <li>Pour les pièces qui nécessitent une soudure, mieux vaut être bien équipé ou expérimenté.</li>
</ul>
<strong>LES GARANTIES ReparMonPhone</strong>
<ul>
  <li>Pièces testées avant expédition, pour une fiabilité optimale.</li>
  <li>Garantie de bon fonctionnement sur chaque produit.</li>
  <li>Politique de retour souple, sans complication.</li>
</ul>`,
];

function pickVariant(productId) {
  const hash = crypto.createHash('md5').update(productId).digest();
  return hash[0] % VARIANTS.length;
}

// Repère le bloc à remplacer, de "NOS CONSEILS" jusqu'à la fin de TOUT ce qui suit "retours souples
// et rapides" tant que ce ne sont que des points/espaces/balises fermantes (</strong>, </li>, </ul>,
// </div>, </p>...). Les fiches d'origine ont un HTML assez sale (balises mal fermées, dupliquées) —
// on avale donc tous les débris de fermeture qui traînent, quel que soit leur nombre, plutôt qu'une
// seule occurrence fixe, pour ne rien laisser derrière le texte de remplacement.
function extractBlock(desc) {
  const startMatch = desc.match(/(<strong>)?NOS CONSEILS(<\/strong>)?/i);
  if (!startMatch) return null;
  const startIdx = startMatch.index;
  const rest = desc.slice(startIdx);
  const endMatch = rest.match(/retours souples et rapides[\s.]*(?:<\/[a-zA-Z0-9]+>[\s.]*)*/i);
  if (!endMatch) return null;
  const endIdx = startIdx + endMatch.index + endMatch[0].length;
  return { start: startIdx, end: endIdx, text: desc.slice(startIdx, endIdx) };
}

// Vérifie qu'il ne reste pas de débris juste après le point de remplacement (balise fermante ou point
// orphelins) — sert uniquement à alerter s'il faut élargir encore la détection ci-dessus.
function hasTrailingDebris(after, insertEndIdx) {
  const next = after.slice(insertEndIdx, insertEndIdx + 40);
  return /^\s*\.?\s*<\/[a-zA-Z0-9]+>/.test(next);
}

// Empreinte propre à la Famille A : les 4 conseils "référence / SIM-SD-Power-Volume / nappes / soudure".
function isFamilyA(desc) {
  return (
    /NOS CONSEILS/i.test(desc) &&
    /SIM\s*\/\s*SD/i.test(desc) &&
    /pincer/i.test(desc) &&
    /nappes/i.test(desc) &&
    /soudure/i.test(desc)
  );
}

async function main() {
  const products = await prisma.product.findMany({
    where: { description: { contains: 'NOS CONSEILS' } },
    select: { id: true, slug: true, title: true, pieceType: true, description: true },
  });

  const candidates = products.filter((p) => isFamilyA(p.description));
  console.log(`Fiches identifiées comme "Famille A" (conseils génériques nappe/connecteur) : ${candidates.length}`);

  const changes = [];
  const variantCounts = [0, 0, 0, 0];
  let skippedNoBlock = 0;
  let debrisCount = 0;
  const debrisExamples = [];
  for (const p of candidates) {
    const block = extractBlock(p.description);
    if (!block) {
      skippedNoBlock++;
      continue;
    }
    const variantIdx = pickVariant(p.id);
    variantCounts[variantIdx]++;
    const insertEndIdx = block.start + VARIANTS[variantIdx].length;
    const after = p.description.slice(0, block.start) + VARIANTS[variantIdx] + p.description.slice(block.end);
    if (hasTrailingDebris(after, insertEndIdx)) {
      debrisCount++;
      if (debrisExamples.length < 5) debrisExamples.push({ p, after, insertEndIdx });
    }
    changes.push({ p, after, variantIdx });
  }

  console.log(`Bloc repéré et remplaçable : ${changes.length}`);
  if (skippedNoBlock > 0) console.log(`Non repérés (format inattendu, à vérifier manuellement) : ${skippedNoBlock}`);
  console.log(`Répartition des 4 variantes : ${variantCounts.map((c, i) => `#${i + 1}: ${c}`).join('  ')}`);
  console.log(`Débris détectés juste après le remplacement (balise/point orphelin) : ${debrisCount}`);

  if (debrisExamples.length > 0) {
    console.log('\n========== Exemples AVEC débris (à corriger avant application) ==========');
    for (const { p, after, insertEndIdx } of debrisExamples) {
      console.log(`\n--- ${p.title} (/produit/${p.slug}) [${p.pieceType}] ---`);
      console.log('Ce qui suit immédiatement le bloc inséré :', JSON.stringify(after.slice(insertEndIdx, insertEndIdx + 60)));
    }
  }

  console.log('\n========== Aperçu (5 exemples avant/après, sans débris) ==========');
  for (const { p, after, variantIdx } of changes.filter((c) => !debrisExamples.some((d) => d.p.id === c.p.id)).slice(0, 5)) {
    console.log(`\n--- ${p.title} (/produit/${p.slug}) [${p.pieceType}] — variante #${variantIdx + 1} ---`);
    console.log('APRÈS (description complète) :');
    console.log(after.length > 1200 ? after.slice(0, 1200) + '...[tronqué]' : after);
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
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
