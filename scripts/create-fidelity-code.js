// Crée (ou remet à jour) le code promo de fidélité REPARMONPHONEFIDELITY :
//   - 5 % sur tout le panier, sans date de fin, utilisations illimitées au total
//   - réservé à la 2ème commande (le client doit déjà avoir une commande payée)
//   - utilisable 1 seule fois par client (e-mail / compte / adresse IP)
// Lancer APRÈS « npm run db:push » :   node scripts/create-fidelity-code.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.migration') });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const code = 'REPARMONPHONEFIDELITY';
  const data = {
    type: 'PERCENT',
    value: 5,
    active: true,
    expiresAt: null,
    maxUses: null,
    oncePerCustomer: true,
    requiresPriorOrder: true,
  };
  const existing = await prisma.promoCode.findUnique({ where: { code } });
  if (existing) {
    await prisma.promoCode.update({ where: { code }, data });
    console.log('✅ Code REPARMONPHONEFIDELITY mis à jour.');
  } else {
    await prisma.promoCode.create({ data: { code, ...data } });
    console.log('✅ Code REPARMONPHONEFIDELITY créé.');
  }
}

main()
  .catch((e) => { console.error('❌ Erreur :', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
