/**
 * Corrige les 754 produits Xiaomi importés par scripts/import-xiaomi-products.js :
 *
 * 1) La "Description courte" de ces produits contient un texte de bienvenue copié tel quel depuis
 *    l'export du fournisseur (pieces2mobile), qui se termine par une mention de SA politique de
 *    livraison : "Envois gratuits dès 35 euros. Comptes professionnels." — remplacée ici par
 *    "Envois gratuits dès 250 euros." (le seuil réel de ReparMonPhone), et la mention "Comptes
 *    professionnels" est supprimée (non pertinente ici).
 *
 * 2) Ces mêmes produits n'ont pas de Meta description (SEO) renseignée. On en génère une, dans le
 *    même style que la génération automatique déjà utilisée ailleurs sur le site (voir
 *    src/lib/seoText.ts et src/app/produit/[slug]/page.tsx) : "{titre} : {type de pièce} {qualité}
 *    pour {marque} {modèle}." + mention livraison Chronopost 24h, coupé à 160 caractères.
 *
 * On cible précisément ces produits en cherchant "Envois gratuits" dans la description courte —
 * ce texte ne vient QUE de cet import Xiaomi (vérifié dans le CSV fournisseur d'origine), donc ce
 * critère isole exactement le bon lot sans toucher aux autres produits du catalogue.
 *
 * MODE APERÇU (par défaut, aucune écriture) :
 *   node scripts/fix-xiaomi-import-textes.js
 *
 * MODE RÉEL :
 *   node scripts/fix-xiaomi-import-textes.js --apply
 */

const path = require('path');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: path.join(__dirname, '../.env.migration') });

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

// --- Reproduit exactement src/lib/seoText.ts pour générer des meta descriptions cohérentes avec
// le reste du site (voir ce fichier si jamais le message de livraison change un jour) ---
const PIECE_TYPE_LABELS = {
  ECRAN: 'écran',
  BATTERIE: 'batterie',
  NAPPE_CONNECTEUR: 'nappe / connecteur de charge',
  CAMERA: 'caméra',
  VITRE_ARRIERE: 'vitre arrière',
  CHASSIS: 'châssis',
  HAUT_PARLEUR: 'haut-parleur',
  VIBREUR: 'vibreur',
  BOUTON: 'bouton',
  OUTILLAGE: 'outil de réparation',
  ACCESSOIRE: 'accessoire',
  AUTRE: 'pièce détachée',
};
const DELIVERY_LINE = 'Livraison Chronopost 24h en France métropolitaine';
function mentionsDelivery(text) {
  return /livraison|chronopost|24\s*h\b|24h/i.test(text);
}
function withDeliveryMention(text, maxLength = 160) {
  const trimmed = text.trim();
  const withDelivery = mentionsDelivery(trimmed) ? trimmed : `${trimmed} ${DELIVERY_LINE}.`;
  if (withDelivery.length <= maxLength) return withDelivery;
  const budget = maxLength - DELIVERY_LINE.length - 2;
  const shortened = trimmed.length > budget ? `${trimmed.slice(0, Math.max(0, budget - 1)).trim()}…` : trimmed;
  return mentionsDelivery(shortened) ? shortened : `${shortened} ${DELIVERY_LINE}.`;
}
function qualitePhrase(quality) {
  if (quality && /origine/i.test(quality)) return "d'origine, neuve et testée";
  if (quality && /reconditionn/i.test(quality)) return 'reconditionnée, testée et garantie';
  return 'de remplacement, testée et garantie';
}

// Texte fournisseur à remplacer (tolérant aux variations d'espace/majuscule/point final)
const BOILERPLATE_RE = /Envois gratuits dès 35\s*euros\.\s*Comptes professionnels\.?/gi;
const REPLACEMENT = 'Envois gratuits dès 250 euros.';

async function main() {
  console.log(APPLY ? 'MODE REEL - la base va etre modifiee.\n' : 'MODE APERCU - aucune ecriture ne sera faite.\n');

  const candidats = await prisma.product.findMany({
    where: { shortDescription: { contains: 'Envois gratuits' } },
    select: {
      id: true,
      title: true,
      shortDescription: true,
      metaDescription: true,
      pieceType: true,
      quality: true,
      model: { select: { name: true, productLine: { select: { brand: { select: { name: true } } } } } },
    },
  });

  console.log(`${candidats.length} produit(s) trouvé(s) avec le texte fournisseur à corriger.\n`);

  const updates = [];
  for (const p of candidats) {
    const newShortDescription = p.shortDescription.replace(BOILERPLATE_RE, REPLACEMENT);
    let newMetaDescription = p.metaDescription;
    if (!p.metaDescription || !p.metaDescription.trim()) {
      const brandName = p.model?.productLine?.brand?.name || '';
      const modelName = p.model?.name || '';
      const raw = `${p.title} : ${PIECE_TYPE_LABELS[p.pieceType] || 'pièce détachée'} ${qualitePhrase(p.quality)} pour ${brandName} ${modelName}.`;
      newMetaDescription = withDeliveryMention(raw);
    }
    updates.push({ id: p.id, title: p.title, newShortDescription, newMetaDescription, hadMeta: !!(p.metaDescription && p.metaDescription.trim()) });
  }

  const metaAGenerer = updates.filter((u) => !u.hadMeta).length;
  console.log(`${metaAGenerer} produit(s) vont recevoir une Meta description générée (les autres en avaient déjà une, non touchée).\n`);

  console.log('--- Aperçu (5 premiers) ---');
  for (const u of updates.slice(0, 5)) {
    console.log(`\n"${u.title}"`);
    console.log(`  Description courte -> ...${u.newShortDescription.slice(-90)}`);
    console.log(`  Meta description   -> ${u.newMetaDescription}`);
  }

  if (!APPLY) {
    console.log('\nAperçu uniquement — relance avec --apply pour écrire ces corrections en base.');
    await prisma.$disconnect();
    return;
  }

  let done = 0;
  for (const u of updates) {
    await prisma.product.update({
      where: { id: u.id },
      data: { shortDescription: u.newShortDescription, metaDescription: u.newMetaDescription },
    });
    done++;
  }

  console.log(`\n✅ ${done} produit(s) corrigés (description courte + meta description).`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
