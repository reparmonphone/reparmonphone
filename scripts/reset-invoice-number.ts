/**
 * Redémarre le compteur de numéro de facture à une valeur choisie (11555 par défaut),
 * au lieu de reprendre à 1 automatiquement. À lancer UNE SEULE FOIS.
 *
 * Usage : npm run reset-invoice-number -- 11555
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const start = parseInt(process.argv[2] ?? '11555', 10);
  if (isNaN(start) || start < 1) {
    console.error('Merci de fournir un nombre entier positif. Exemple : npm run reset-invoice-number -- 11555');
    process.exit(1);
  }

  // Nom de séquence standard généré par Postgres pour une colonne @default(autoincrement())
  await prisma.$executeRawUnsafe(
    `ALTER SEQUENCE "orders_invoiceNumber_seq" RESTART WITH ${start};`
  );

  console.log(`✅ Le prochain numéro de facture généré sera ${start}.`);
}

main()
  .catch((e) => {
    console.error(e);
    console.error(
      '\nSi tu as une erreur "relation does not exist", le nom exact de la séquence diffère peut-être ' +
        'sur ta base — va sur le SQL Editor de Supabase et lance :\n' +
        `  SELECT column_name, column_default FROM information_schema.columns WHERE table_name='orders' AND column_name='invoiceNumber';\n` +
        'pour trouver le vrai nom de séquence (visible dans column_default, ex: nextval(\'xxx\'::regclass)), puis adapte la commande ALTER SEQUENCE en conséquence.'
    );
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
