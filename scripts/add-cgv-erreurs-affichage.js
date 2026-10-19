// Ajoute dans les CGV (page "cgv" en base) un nouvel article "Article 3 bis. Erreurs d'affichage du
// stock ou du prix", placé juste avant l'Article 4 pour ne renuméroter aucun article existant.
// Le script garde tout le reste des CGV tel quel (il lit le contenu actuel en base, donc tes
// modifications faites depuis l'admin sont conservées) et ne s'ajoute qu'une seule fois.
// Une copie de sauvegarde des CGV d'avant modification est écrite dans scripts/cache/.
//
// Usage :
//   node scripts/add-cgv-erreurs-affichage.js            (aperçu, aucune écriture)
//   node scripts/add-cgv-erreurs-affichage.js --apply     (applique réellement la modification)

require('dotenv').config({ path: require('path').join(__dirname, '../.env.migration') });
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');

const MARKER = 'Erreurs d\'affichage du stock ou du prix';

const NEW_ARTICLE_HTML = `<h2>Article 3 bis. Erreurs d'affichage du stock ou du prix</h2>
<p>ReparMonPhone.fr met à jour les fiches produits (prix et disponibilité) aussi régulièrement que possible. Compte tenu du nombre de produits et de la fréquence des mises à jour, il peut arriver qu'un stock ou un prix affiché sur le site soit erroné, sans que la société puisse contrôler la totalité des produits en temps réel.</p>
<p>Le présent article s'applique dans deux cas : (a) le produit commandé n'est en réalité plus disponible en stock ; (b) le prix affiché est manifestement erroné, c'est-à-dire totalement décalé par rapport au prix réel du marché pour ce produit.</p>
<p><strong>Information de l'acheteur.</strong> Lorsqu'une commande est passée alors qu'une telle erreur existe, ReparMonPhone.fr en informe directement l'acheteur par email, à l'adresse indiquée lors de la commande, en principe dans les heures qui suivent la constatation de l'erreur, en précisant le produit concerné.</p>
<p><strong>Délai de réponse de 24 heures.</strong> L'acheteur dispose de vingt-quatre (24) heures à compter de l'envoi de ce message pour répondre et indiquer son choix (par exemple : accepter un produit de remplacement, ou le maintien de la commande au prix corrigé lorsque cela est possible).</p>
<p><strong>Absence de réponse.</strong> À défaut de réponse de l'acheteur dans ce délai, le produit concerné est retiré de la commande et remboursé sur le moyen de paiement utilisé pour la commande. Si la commande comprend d'autres produits, ceux-ci sont expédiés normalement. Si la commande ne comprend plus aucun produit, elle est annulée et remboursée intégralement.</p>
<p><strong>Remboursement.</strong> Le remboursement est effectué dans les meilleurs délais et au plus tard dans les quatorze (14) jours suivant le retrait du produit ou l'annulation de la commande.</p>
<p>Le retrait d'un produit ou l'annulation d'une commande pour cause d'erreur d'affichage du stock ou du prix, dans les conditions du présent article, n'ouvre droit à aucune indemnité autre que le remboursement des sommes versées pour ce produit.</p>

`;

async function main() {
  const page = await prisma.page.findUnique({ where: { slug: 'cgv' } });
  if (!page) {
    console.error('❌ Aucune page avec le slug "cgv" trouvée.');
    process.exit(1);
  }

  if (page.contentHtml.includes(MARKER)) {
    console.log('✅ Cet article est déjà présent dans les CGV. Rien à faire.');
    return;
  }

  // Insertion juste avant "Article 4." ; à défaut, à la fin de la page.
  const idx = page.contentHtml.search(/<h2[^>]*>\s*Article\s+4\b/i);
  const newHtml =
    idx >= 0
      ? page.contentHtml.slice(0, idx) + NEW_ARTICLE_HTML + page.contentHtml.slice(idx)
      : page.contentHtml + '\n' + NEW_ARTICLE_HTML;

  console.log(idx >= 0 ? 'Position : juste avant l\'Article 4.' : 'Article 4 introuvable : ajout à la fin de la page.');
  console.log('\n--- Article qui sera ajouté ---\n');
  console.log(NEW_ARTICLE_HTML);

  if (!APPLY) {
    console.log('Aperçu uniquement — relance avec --apply pour appliquer réellement la modification.');
    return;
  }

  const backupDir = path.join(__dirname, 'cache');
  fs.mkdirSync(backupDir, { recursive: true });
  const backupFile = path.join(backupDir, 'cgv-avant-erreurs-affichage.html');
  fs.writeFileSync(backupFile, page.contentHtml, 'utf8');
  console.log('💾 Sauvegarde des CGV actuelles : ' + backupFile);

  await prisma.page.update({ where: { slug: 'cgv' }, data: { contentHtml: newHtml } });
  console.log('✅ CGV mises à jour (Article 3 bis ajouté).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
