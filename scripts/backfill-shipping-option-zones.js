/**
 * Backfill de compatibilité pour la fonctionnalité "disponibilité d'une option de livraison par zone".
 *
 * Avant cette fonctionnalité, TOUTES les options de livraison étaient proposées à TOUTES les
 * destinations (France métropolitaine + Outre-mer). Pour ne rien casser au déploiement, ce script crée
 * les lignes ShippingOptionZone manquantes pour chaque (option × zone) déjà existante, ce qui reproduit
 * exactement le comportement actuel : rien ne change tant que tu ne décoches pas toi-même une case
 * "Disponible" dans /admin/livraison.
 *
 * Idempotent : ne crée que les lignes qui n'existent pas encore (skipDuplicates).
 *
 *   node scripts/backfill-shipping-option-zones.js
 */

const path = require('path');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: path.join(__dirname, '../.env.migration') });

const prisma = new PrismaClient();

async function main() {
  const [options, zones] = await Promise.all([
    prisma.shippingOption.findMany({ select: { id: true, label: true } }),
    prisma.shippingZone.findMany({ select: { id: true, name: true } }),
  ]);

  if (options.length === 0 || zones.length === 0) {
    console.log('ℹ️  Aucune option ou aucune zone pour le moment — rien à faire.');
    return;
  }

  const rows = [];
  for (const option of options) {
    for (const zone of zones) {
      rows.push({ shippingOptionId: option.id, zoneId: zone.id });
    }
  }

  const result = await prisma.shippingOptionZone.createMany({ data: rows, skipDuplicates: true });

  console.log(`✅ ${result.count} lien(s) créé(s) (${options.length} option(s) × ${zones.length} zone(s), doublons ignorés).`);
  console.log('\nRien ne change pour tes clients : toutes les options restent proposées partout comme avant.');
  console.log('Va dans /admin/livraison pour décocher "Disponible" sur une option qui ne doit pas être');
  console.log('proposée pour une destination donnée (ex: un Chronopost Express Outre-mer réservé à l\'Outre-mer).');
}

main()
  .catch((e) => {
    console.error('💥 Erreur :', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
