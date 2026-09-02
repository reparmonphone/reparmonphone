// Affiche le contenu actuel (contentHtml) de la page "À propos" (Page.slug = "a-propos") —
// lecture seule, pour vérifier ce qui est en ligne avant de préparer la réécriture demandée
// suite au retour d'audit (chiffres incohérents, horaires "24h/24" au lieu des vrais horaires
// du footer, ton "ancien site").
//
// Usage :
//   node scripts/diagnose-a-propos-page.js

require('dotenv').config({ path: require('path').join(__dirname, '../.env.migration') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const page = await prisma.page.findUnique({ where: { slug: 'a-propos' } });
  if (!page) {
    console.log('❌ Aucune page trouvée avec le slug "a-propos".');
    return;
  }
  console.log(`Titre actuel : ${page.title}`);
  console.log(`Dernière modification : ${page.updatedAt}`);
  console.log('\n--- contentHtml actuel ---\n');
  console.log(page.contentHtml);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
