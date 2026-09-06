/**
 * Rédige une meta description (champ Product.metaDescription) pour chaque produit "Accessoires"
 * importé qui n'en a pas encore une.
 *
 * Pourquoi c'est nécessaire : à l'import (scripts/import-accessoires-products.js), aucun de ces 1378
 * produits n'a reçu de metaDescription — le champ est resté vide. Or src/app/produit/[slug]/page.tsx
 * retombe alors sur `shortDescription` comme meta description, qui vaut pour la quasi-totalité de ces
 * produits : "[Titre]. ReparMonPhone, spécialiste français des pièces détachées pour smartphones et
 * tablettes." — soit une meta description quasi identique sur 1378 pages différentes, ce qui est
 * exactement le type de contenu dupliqué qui avait été identifié comme cause probable des pages
 * "Soft 404" côté pièces détachées (voir scripts/diagnose-duplicate-content.js, projet mis en pause
 * séparément — ceci ne concerne que la balise meta description des accessoires, pas le contenu visible
 * des pages pièces détachées).
 *
 * Chaque description générée reprend le TITRE RÉEL du produit (donc toujours unique) suivi d'une
 * courte phrase factuelle liée à la gamme (ex: "protège l'écran contre les rayures et les chocs" pour
 * "Protection Écran") — jamais de caractéristique inventée. Le message de livraison Chronopost 24h est
 * ajouté automatiquement à l'affichage par src/lib/seoText.ts (withDeliveryMention), donc il n'est pas
 * répété ici.
 *
 * Ne touche QUE les produits dont metaDescription est actuellement vide — relançable sans risque,
 * n'écrase jamais une description que Krys aurait déjà rédigée à la main entre-temps.
 *
 * MODE APERÇU (par défaut, aucune écriture) :
 *   node scripts/generate-accessoires-meta-descriptions.js
 *
 * MODE RÉEL :
 *   node scripts/generate-accessoires-meta-descriptions.js --apply
 */

const path = require('path');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: path.join(__dirname, '../.env.migration') });

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

// Phrase courte et factuelle par gamme — jamais de qualificatif ("fiable", "haut de gamme"...) qui ne
// pourrait pas être vérifié produit par produit.
const BENEFIT_BY_LINE = {
  'Protection Écran': "protège l'écran contre les rayures et les chocs",
  Protection: 'protège votre téléphone au quotidien',
  USAMS: 'accessoire USAMS pour smartphone et tablette',
  'Rock Space': 'accessoire Rock Space pour smartphone et tablette',
  Autonomie: 'pour recharger votre appareil au quotidien',
  Connectique: 'pour charger et connecter vos appareils',
  Audio: 'accessoire audio pour smartphone',
  GoPro: 'accessoire compatible GoPro',
  Autres: 'accessoire pour smartphone et tablette',
};
const DEFAULT_BENEFIT = 'accessoire pour smartphone et tablette';

const MAX_LENGTH = 150; // laisse de la marge à withDeliveryMention() pour ajouter la mention livraison

function buildMetaDescription(title, lineName) {
  const benefit = BENEFIT_BY_LINE[lineName] || DEFAULT_BENEFIT;
  let text = `${title} – ${benefit}.`;
  if (text.length > MAX_LENGTH) {
    const truncated = text.slice(0, MAX_LENGTH - 1);
    const lastSpace = truncated.lastIndexOf(' ');
    text = `${truncated.slice(0, lastSpace > 80 ? lastSpace : MAX_LENGTH - 1)}…`;
  }
  return text;
}

async function main() {
  console.log(APPLY ? 'MODE REEL - la base va etre modifiee.\n' : 'MODE APERCU - aucune ecriture ne sera faite.\n');

  const brand = await prisma.brand.findFirst({ where: { name: 'Accessoires' } });
  if (!brand) {
    console.error('Marque "Accessoires" introuvable en base.');
    process.exit(1);
  }

  const products = await prisma.product.findMany({
    where: {
      model: { productLine: { brandId: brand.id } },
      OR: [{ metaDescription: null }, { metaDescription: '' }],
    },
    include: { model: { include: { productLine: true } } },
  });

  console.log(`${products.length} produit(s) "Accessoires" sans meta description trouvé(s).\n`);

  console.log('--- Aperçu (5 premiers) ---\n');
  for (const p of products.slice(0, 5)) {
    const desc = buildMetaDescription(p.title, p.model.productLine.name);
    console.log(`"${p.title}"`);
    console.log(`   -> ${desc} (${desc.length} caractères)\n`);
  }

  if (!APPLY) {
    console.log(`Aperçu uniquement — ${products.length} produit(s) seraient mis à jour.`);
    console.log('Relance avec --apply pour appliquer réellement.');
    await prisma.$disconnect();
    return;
  }

  let updated = 0;
  for (const p of products) {
    const desc = buildMetaDescription(p.title, p.model.productLine.name);
    await prisma.product.update({ where: { id: p.id }, data: { metaDescription: desc } });
    updated++;
    if (updated % 200 === 0 || updated === products.length) {
      console.log(`... ${updated}/${products.length} produit(s) mis à jour`);
    }
  }

  console.log(`\n✅ ${updated} meta description(s) rédigée(s) et enregistrée(s).`);
  console.log('Terminé.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
