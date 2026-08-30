/**
 * Crée la zone de livraison "Outre-mer" (Guadeloupe, Martinique, Guyane, Réunion, Mayotte, Saint-
 * Pierre-et-Miquelon, Saint-Barthélemy, Saint-Martin, Wallis-et-Futuna, Polynésie française,
 * Nouvelle-Calédonie), en pré-remplissant les préfixes de code postal correspondants. Ne crée AUCUN
 * tarif spécifique (ShippingZoneRate) — tant qu'aucun tarif n'est fixé pour une option de livraison
 * sur cette zone, le prix de base (France métropolitaine) continue de s'appliquer, donc rien ne
 * change pour les clients tant que tu n'as pas toi-même rempli un prix dans /admin/livraison.
 *
 * Idempotent : si une zone "Outre-mer" existe déjà (même nom), ne fait rien.
 *
 *   node scripts/seed-shipping-zone-domtom.js
 */

const path = require('path');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: path.join(__dirname, '../.env.migration') });

const prisma = new PrismaClient();

const ZONE_NAME = 'Outre-mer (Guadeloupe, Martinique, Guyane, Réunion, Mayotte...)';
const POSTAL_PREFIXES = ['971', '972', '973', '974', '975', '976', '977', '978', '986', '987', '988'];

async function main() {
  const existing = await prisma.shippingZone.findFirst({ where: { name: ZONE_NAME } });
  if (existing) {
    console.log(`ℹ️  La zone "${ZONE_NAME}" existe déjà (préfixes actuels : ${existing.postalPrefixes.join(', ')}) — rien à faire.`);
    return;
  }

  const max = await prisma.shippingZone.aggregate({ _max: { order: true } });
  const zone = await prisma.shippingZone.create({
    data: { name: ZONE_NAME, postalPrefixes: POSTAL_PREFIXES, order: (max._max.order ?? 0) + 1 },
  });

  console.log(`✅ Zone créée : "${zone.name}" (préfixes : ${POSTAL_PREFIXES.join(', ')})`);
  console.log('\nAucun tarif n\'est fixé pour l\'instant : tous les clients de cette zone paient encore le tarif de base.');
  console.log('Va dans /admin/livraison, section "Tarifs par zone", pour saisir le vrai tarif de chaque option de livraison vers cette zone.');
}

main()
  .catch((e) => {
    console.error('💥 Erreur :', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
