// Retravaille la page "Livraison & Retours" (slug "livraison-retours") suite à un retour d'audit
// SEO externe : le contenu actuel parle presque exclusivement des retours, la livraison Chronopost
// 24h n'y est mentionnée qu'en une phrase. Ce script fait remonter la livraison en tête de page avec
// les horaires réels confirmés par Krys (commande avant 20h -> expédition le jour même -> livraison
// Chronopost le lendemain avant 13h en France métropolitaine), sans toucher au fond du contenu légal
// (droit de rétractation, garantie écrans, produit défectueux) qui reste exact. Pas de section
// "professionnels" : confirmé par Krys que ce n'est pas un vrai segment de son activité.
//
// Usage :
//   node scripts/update-livraison-retours-page.js            (aperçu, aucune écriture)
//   node scripts/update-livraison-retours-page.js --apply     (applique réellement la mise à jour)

require('dotenv').config({ path: require('path').join(__dirname, '../.env.migration') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');

const NEW_TITLE = 'Livraison Chronopost 24h & Retours';

const NEW_CONTENT_HTML = `<h1>Livraison Chronopost 24h &amp; Retours</h1>

<h2>🚚 Livraison Chronopost Express 24h</h2>
<p>Toute commande de pièces détachées passée avant 20h est préparée et expédiée le jour même depuis notre atelier de Sainte-Maxime (Var), via Chronopost. Livraison estimée le lendemain avant 13h pour la majorité de la France métropolitaine.</p>
<ul>
<li><strong>Commande avant 20h</strong> : préparation et expédition le jour même, du lundi au vendredi.</li>
<li><strong>Livraison Chronopost</strong> : le lendemain avant 13h pour la majorité de la France métropolitaine.</li>
<li><strong>Frais de port offerts</strong> dès 250&nbsp;€ TTC de commande en France métropolitaine.</li>
<li>Délais plus longs pour la Corse et les DOM-TOM.</li>
<li>Un email de suivi avec numéro de tracking est envoyé dès la prise en charge du colis par le transporteur.</li>
</ul>
<p>À réception, nous vous invitons à vérifier l'état de l'emballage. En cas de dommage constaté pendant le transport, merci de nous contacter rapidement et d'effectuer votre réclamation auprès du transporteur dans un délai de 3 jours à compter de la livraison.</p>

<h2>Droit de rétractation (14 jours)</h2>
<p>Conformément à l'article L221-18 du Code de la consommation, vous disposez d'un délai de <strong>14 jours</strong> à compter de la réception de votre commande pour exercer votre droit de rétractation, sans avoir à justifier de motifs ni à payer de pénalités (à l'exception des frais de retour, à votre charge).</p>
<p>Pour retourner un article :</p>
<ol>
<li>Contactez-nous à <a href="mailto:contact@reparmonphone.fr">contact@reparmonphone.fr</a> en précisant votre numéro de commande et le produit concerné.</li>
<li>Nous vous confirmons la marche à suivre pour le retour.</li>
<li>Retournez le produit dans son emballage d'origine, non utilisé, avec l'ensemble de ses accessoires.</li>
</ol>
<p>Une fois le retour reçu et vérifié, nous procédons au remboursement sur votre moyen de paiement d'origine, dans les meilleurs délais et au plus tard sous 14 jours conformément à la loi.</p>

<h2>Garantie écrans</h2>
<p>Tous nos écrans sont garantis <strong>1 an</strong> à compter de la date d'achat contre les bugs tactiles ou défauts d'affichage. Toute pièce ayant été installée, collée sur un appareil, ou dont l'étiquette de sécurité a été retirée, ne peut plus faire l'objet d'un retour ou d'une prise en charge sous garantie.</p>
<p>Le détail complet des conditions de garantie par type d'écran (Optimum, Standard, New Life, Service Pack...) figure dans nos <a href="/cgv">Conditions Générales de Vente</a>.</p>

<h2>Produit défectueux ou erreur de notre part</h2>
<p>Si vous recevez un produit défectueux ou différent de votre commande, contactez-nous à contact@reparmonphone.fr : l'échange ou le remboursement se fait alors sans frais de retour à votre charge.</p>

<h2>Besoin d'aide ?</h2>
<p>Notre équipe est à votre disposition du lundi au samedi, de 9h à 18h : <a href="mailto:contact@reparmonphone.fr">contact@reparmonphone.fr</a> — <a href="tel:+33783497262">07 83 49 72 62</a>.</p>
`;

async function main() {
  const page = await prisma.page.findUnique({ where: { slug: 'livraison-retours' } });
  if (!page) {
    console.error('❌ Aucune page avec le slug "livraison-retours" trouvée.');
    process.exit(1);
  }

  console.log('--- Titre actuel ---');
  console.log(page.title);
  console.log('\n--- Nouveau titre ---');
  console.log(NEW_TITLE);
  console.log('\n--- Nouveau contenu (aperçu) ---\n');
  console.log(NEW_CONTENT_HTML);

  if (APPLY) {
    await prisma.page.update({
      where: { slug: 'livraison-retours' },
      data: { title: NEW_TITLE, contentHtml: NEW_CONTENT_HTML },
    });
    console.log('\n✅ Page "livraison-retours" mise à jour.');
  } else {
    console.log('\nAperçu uniquement — relance avec --apply pour appliquer réellement cette mise à jour.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
