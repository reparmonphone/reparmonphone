// Ajoute dans les CGV (page "cgv" en base) un nouvel article "Article 3 bis. Erreurs d'affichage du
// stock ou du prix", placé juste avant l'Article 4 pour ne renuméroter aucun article existant.
// Le script garde tout le reste des CGV tel quel (il lit le contenu actuel en base, donc tes
// modifications faites depuis l'admin sont conservées) et peut être relancé sans risque (il remplace sa propre version si elle est déjà là).
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

const NEW_ARTICLE_HTML = `<h2>Article 3 bis. Erreurs d'affichage du stock ou du prix</h2>
<p>ReparMonPhone.fr met à jour les fiches produits (prix et disponibilité) aussi régulièrement que possible. Compte tenu du nombre de produits et de la fréquence des mises à jour, il peut arriver qu'un stock ou un prix affiché sur le site soit erroné, sans que la société puisse contrôler la totalité des produits en temps réel. Les produits sont proposés sous réserve de leur disponibilité effective (article 2).</p>
<p>Le présent article s'applique dans deux cas : (a) le produit commandé n'est en réalité plus disponible en stock ; (b) le prix affiché est manifestement erroné, c'est-à-dire totalement décalé par rapport au prix réel du marché pour ce produit. Dans ces deux cas, l'acheteur ne peut pas exiger la livraison du produit au prix affiché par erreur.</p>
<p><strong>Information de l'acheteur.</strong> Lorsqu'une commande est passée alors qu'une telle erreur existe, ReparMonPhone.fr en informe directement l'acheteur par email, à l'adresse indiquée lors de la commande (et, le cas échéant, par téléphone), en principe dans les heures qui suivent la constatation de l'erreur, en précisant le produit concerné. L'acheteur est réputé informé dès l'envoi de ce message à l'adresse indiquée.</p>
<p><strong>Délai de réponse de 24 heures.</strong> L'acheteur dispose de vingt-quatre (24) heures à compter de l'envoi de ce message pour répondre, par email (en répondant à ce message) ou par téléphone au 07 83 49 72 62, et indiquer son choix : accepter un produit de remplacement, maintenir la commande au prix corrigé lorsque cela est possible, attendre la remise en stock lorsqu'une date est connue, ou annuler.</p>
<p><strong>Absence de réponse.</strong> À défaut de réponse de l'acheteur dans ce délai, le produit concerné est retiré de la commande et remboursé sur le moyen de paiement utilisé pour la commande. Si la commande comprend d'autres produits, ceux-ci sont expédiés normalement, et les frais de livraison offerts ainsi que les éventuelles réductions appliquées à la commande restent acquis, dans la limite du montant de la commande. Si la commande ne comprend plus aucun produit, elle est annulée et remboursée intégralement. Passé le délai de 24 heures, le retrait du produit est définitif ; l'acheteur qui souhaite malgré tout acquérir ce produit peut passer une nouvelle commande, aux conditions affichées à cette date.</p>
<p><strong>Produit déjà expédié.</strong> Si l'erreur est constatée après l'expédition du produit, ReparMonPhone.fr contacte l'acheteur pour convenir avec lui d'une solution : conservation du produit au prix corrigé, ou retour du produit, aux frais de ReparMonPhone.fr, avec remboursement.</p>
<p><strong>Remboursement.</strong> Le remboursement est effectué dans les meilleurs délais et au plus tard dans les quatorze (14) jours suivant le retrait du produit ou l'annulation de la commande. Le droit de rétractation prévu à l'article 6 demeure applicable.</p>
<p>Le retrait d'un produit ou l'annulation d'une commande pour cause d'erreur d'affichage du stock ou du prix, dans les conditions du présent article, n'ouvre droit à aucune indemnité autre que le remboursement des sommes versées pour ce produit, sauf faute de ReparMonPhone.fr.</p>

`;

async function main() {
  const page = await prisma.page.findUnique({ where: { slug: 'cgv' } });
  if (!page) {
    console.error('❌ Aucune page avec le slug "cgv" trouvée.');
    process.exit(1);
  }

  // Si une version de l'article est déjà présente (ancienne version), on la remplace ; sinon on
  // l'insère juste avant "Article 4." (à défaut, à la fin de la page).
  const html = page.contentHtml;
  const start = html.search(/<h2[^>]*>\s*Article\s+3\s+bis\b/i);
  let newHtml;
  let position;
  if (start >= 0) {
    const nextH2 = html.indexOf('<h2', start + 4);
    const end = nextH2 >= 0 ? nextH2 : html.length;
    newHtml = html.slice(0, start) + NEW_ARTICLE_HTML + html.slice(end);
    position = "Un Article 3 bis existe déjà : il sera remplacé par cette version.";
  } else {
    const idx = html.search(/<h2[^>]*>\s*Article\s+4\b/i);
    newHtml = idx >= 0 ? html.slice(0, idx) + NEW_ARTICLE_HTML + html.slice(idx) : html + '\n' + NEW_ARTICLE_HTML;
    position = idx >= 0 ? "Position : juste avant l'Article 4." : "Article 4 introuvable : ajout à la fin de la page.";
  }

  if (newHtml === html) {
    console.log('✅ Les CGV contiennent déjà cette version exacte de l\'article. Rien à faire.');
    return;
  }

  console.log(position);
  console.log('\n--- Article ---\n');
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
