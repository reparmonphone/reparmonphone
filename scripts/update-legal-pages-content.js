// Met à jour le contenu (contentHtml) des pages CGV et Livraison & Retours dans la base, pour
// corriger les incohérences relevées dans l'audit du site (juillet/août 2026) :
//   - CGV Article 4 : retire l'option "virement bancaire" (non utilisée en pratique), clarifie
//     que le paiement se fait par carte bancaire (Stripe) ou PayPal.
//   - CGV Article 6 : corrige la référence légale du droit de rétractation, qui citait encore
//     l'ancien article L121-20 du Code de la consommation (recodifié depuis 2016 sous L221-18),
//     et aligne le délai sur "14 jours à compter de la réception" (formulation légale exacte).
//   - Livraison & Retours : remplace le texte générique de template e-commerce ("cartes cadeaux",
//     "articles en solde", retour sous 30 jours) par un texte propre à ReparMonPhone, cohérent
//     avec les CGV (retour sous 14 jours, Chronopost/Colissimo, garantie écrans 1 an).
//
// Ne touche à rien d'autre (title, slug, autres pages) : seul contentHtml est réécrit pour ces
// deux slugs. Ce contenu vit uniquement en base (table "pages"), pas dans le code source — d'où
// ce script plutôt qu'une modification de fichier.
//
// Usage :
//   node scripts/update-legal-pages-content.js --dry-run
//   node scripts/update-legal-pages-content.js

require('dotenv').config({ path: require('path').join(__dirname, '../.env.migration') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes('--dry-run');

const CGV_HTML = `
<h1>Conditions Générales de Vente</h1>

<h2>Article 1. Objet</h2>
<p>Les présentes conditions générales de vente définissent les relations contractuelles entre ReparMonPhone.fr et l'acheteur. L'acquisition d'un produit sur le site implique une acceptation sans réserve des présentes conditions. L'acheteur déclare que l'achat effectué est sans rapport direct avec son activité professionnelle et est limité à un usage personnel. La société se réserve le droit de modifier ces conditions à tout moment.</p>

<h2>Article 2. Produits</h2>
<p>Les produits proposés sont ceux qui figurent sur le site, dans la limite des stocks disponibles. La société ReparMonPhone.fr se réserve le droit de modifier à tout moment l'assortiment de produits. Les photographies illustrant les produits sont les plus fidèles possibles mais ne peuvent assurer une similitude parfaite avec le produit offert, notamment en ce qui concerne les couleurs.</p>

<h2>Article 3. Tarifs</h2>
<p>Les prix figurant sur le site sont indiqués en euros toutes taxes comprises (TTC), incluant la TVA applicable au jour de la commande. Tout changement du taux de la TVA pourra être répercuté sur le prix des produits. Les frais de livraison sont facturés en supplément du prix des produits achetés. En France métropolitaine, pour toute commande supérieure ou égale à 250&nbsp;€ TTC, les frais de port sont offerts.</p>

<h2>Article 4. Commande et modalités de paiement</h2>
<p>Pour passer commande, l'acheteur doit créer un compte sur le site. Le règlement des achats s'effectue par carte bancaire (Visa, Mastercard, American Express) via une passerelle de paiement sécurisée, ou via PayPal.</p>
<p>Le paiement est débité au moment de la validation de la commande. En cas d'utilisation frauduleuse de son moyen de paiement, l'acheteur est invité à contacter sans délai l'émetteur de sa carte ou PayPal pour en demander l'annulation, dans les conditions prévues par leurs conditions générales respectives.</p>
<p>La confirmation de commande entraîne acceptation des présentes conditions générales de vente.</p>
<p>Pour toute question relative à une commande : courrier à Les Saquèdes, 83120 Sainte-Maxime — email : contact@reparmonphone.fr — téléphone : 07 83 49 72 62.</p>

<h2>Article 5. Réserve de propriété</h2>
<p>ReparMonPhone.fr conserve la propriété pleine et entière des produits vendus jusqu'au complet encaissement du prix, en principal et en accessoires.</p>

<h2>Article 6. Droit de rétractation</h2>
<p>Conformément à l'article L221-18 du Code de la consommation, l'acheteur dispose d'un délai de quatorze (14) jours à compter de la réception du produit pour exercer son droit de rétractation, sans avoir à justifier de motifs ni à payer de pénalités, à l'exception, le cas échéant, des frais de retour.</p>

<h2>Article 7. Livraison</h2>
<p>Les livraisons sont faites à l'adresse indiquée sur le bon de commande, via La Poste (Colissimo) ou Chronopost, avec numéro de suivi. Les délais de livraison ne sont donnés qu'à titre indicatif ; si ceux-ci dépassent trente jours à compter de la commande, le contrat de vente pourra être résilié.</p>
<p>En cas de retour de produit pour livraison non conforme, les frais de port sont remboursés sur la base du tarif facturé. L'acheteur doit vérifier l'état de l'emballage des produits livrés. En cas de dommage pendant le transport, toute protestation doit être effectuée auprès du transporteur dans un délai de trois jours à compter de la livraison.</p>

<h2>Article 8. Garantie</h2>
<p>Tous les produits fournis par ReparMonPhone.fr bénéficient de la garantie légale prévue par les articles 1641 et suivants du Code civil. Dans ce cadre, l'acheteur doit signaler toute réclamation dans un délai de trente jours après livraison, à l'adresse suivante : ReparMonPhone.fr, Les Saquèdes, 83120 Sainte-Maxime.</p>
<p>Avant tout retour, l'acheteur doit impérativement faire une demande préalable par email à contact@reparmonphone.fr.</p>

<h3>Garantie spécifique écrans</h3>
<ul>
<li>Tous nos écrans sont garantis 1 an à compter de la date d'achat.</li>
<li>Les écrans iPhone gammes Optimum, Standard et New Life sont couverts en cas de bugs tactiles ou de défaut d'affichage.</li>
<li>Toute pièce détachée d'origine ayant été installée ou collée sur un appareil ne pourra faire l'objet d'aucune prise en charge au titre de la garantie.</li>
<li>Toute pièce dont l'étiquette de sécurité « SEALED » a été retirée ou ouverte est exclue de tout droit au retour ou à la garantie.</li>
</ul>

<h3>Conditions pour écrans iPhone</h3>
<p>Les blocages liés à une mise à jour, les défauts de montage (nappe déchirée, connectiques abîmées) et les vitres ou dalles cassées après réception ne sont pas couverts par la garantie.</p>

<h3>Conditions pour écrans d'origine / Service Pack</h3>
<p>Le retour doit se faire dans la boîte d'origine scellée, sans utilisation ni collage, avec les nappes intactes, les films de protection intacts, et le sticker de garantie présent.</p>

<h3>Conditions pour écrans New Life Samsung / Xiaomi / Huawei / Oppo / OnePlus / Vivo / Google / Realme</h3>
<p>Pas d'utilisation ni de collage, nappes intactes, films de protection intacts, sticker de garantie présent.</p>

<p>Tout article retourné doit inclure l'emballage d'origine, la confirmation de retour, et l'ensemble de ses accessoires.</p>

<h2>Article 9. Responsabilité</h2>
<p>ReparMonPhone.fr n'est tenue que par une obligation de moyens dans le cadre du processus de commande. Sa responsabilité ne pourra être engagée pour un dommage résultant de l'utilisation du réseau Internet, tel que perte de données, intrusion, virus, rupture du service, ou autres problèmes involontaires.</p>

<h2>Article 10. Propriété intellectuelle</h2>
<p>Tous les éléments du site https://www.reparmonphone.fr sont et restent la propriété intellectuelle et exclusive de la société ReparMonPhone.fr. Nul n'est autorisé à reproduire, exploiter, ou utiliser à quelque titre que ce soit, même partiellement, des éléments du site, qu'ils soient logiciels, visuels ou sonores.</p>

<h2>Article 11. Données à caractère personnel</h2>
<p>ReparMonPhone.fr s'engage à préserver la confidentialité des informations fournies par l'acheteur, conformément à la loi n° 78-17 du 6 janvier 1978 relative à l'informatique, aux fichiers et aux libertés, ainsi qu'au Règlement Général sur la Protection des Données (RGPD). L'internaute dispose d'un droit d'accès, de modification et de suppression des données le concernant, qu'il peut exercer en écrivant à contact@reparmonphone.fr.</p>

<h2>Article 12. Règlement des litiges</h2>
<p>Les présentes conditions de vente à distance sont soumises à la loi française. En cas de litige, une solution amiable sera recherchée avant toute action judiciaire. À défaut, le tribunal compétent est celui de Draguignan (83).</p>
`.trim();

const LIVRAISON_RETOURS_HTML = `
<h1>Livraison &amp; Retours</h1>

<h2>Livraison</h2>
<p>Toutes nos commandes sont expédiées depuis notre atelier situé à Sainte-Maxime (Var), via Chronopost ou Colissimo, avec un numéro de suivi communiqué par email dès l'expédition.</p>
<ul>
<li><strong>Délai estimé :</strong> 24h pour la majorité de la France métropolitaine. Les délais peuvent être plus longs pour la Corse et les DOM-TOM.</li>
<li><strong>Frais de port offerts</strong> dès 250&nbsp;€ TTC de commande en France métropolitaine.</li>
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
`.trim();

async function main() {
  console.log(DRY_RUN ? '--- MODE DRY-RUN (aucune écriture) ---\n' : '--- MISE À JOUR RÉELLE ---\n');

  const targets = [
    { slug: 'cgv', html: CGV_HTML, label: 'CGV' },
    { slug: 'livraison-retours', html: LIVRAISON_RETOURS_HTML, label: 'Livraison & Retours' },
  ];

  for (const { slug, html, label } of targets) {
    const existing = await prisma.page.findUnique({ where: { slug } });
    if (!existing) {
      console.log(`⚠️  Aucune page trouvée pour le slug "${slug}" (${label}) — rien à mettre à jour.`);
      continue;
    }
    console.log(`${label} (slug: ${slug}) — ${existing.contentHtml.length} caractères → ${html.length} caractères`);
    if (!DRY_RUN) {
      await prisma.page.update({ where: { slug }, data: { contentHtml: html } });
      console.log(`   ✅ mis à jour`);
    }
  }

  console.log(DRY_RUN ? '\nDry-run terminé, aucune écriture effectuée.' : '\nTerminé.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
