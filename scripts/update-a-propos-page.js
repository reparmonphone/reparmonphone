// Remplace le contenu de la page "À propos" (Page.slug = "a-propos") — actuellement encore le
// texte générique du thème WordPress d'origine (images "xstore.8theme.com", faux avis clients,
// "Assistance 24h/24 et 7j/7", chiffres incohérents "2500+ commandes/an" vs "45/jour") — par un
// texte réel sur ReparMonPhone, avec les vrais chiffres :
//   - 20 ans d'expérience (donné par Krys)
//   - 750 commandes livrées par an (donné par Krys)
//   - horaires exacts du footer : Lun-Sam 9h-18h (au lieu de "24h/24 7j/7")
//   - stock réel au 2026-09-02 : 6671 produits en boutique, 612 modèles, 5 marques
//     (voir scripts/diagnose-catalog-stats.js) — arrondis prudemment à la baisse
//     ("6 500+" pièces, "600+" modèles) pour rester vrai même si le stock varie un peu.
// Les faux avis clients du thème sont retirés ; un lien vers /avis-verifies (vrais avis) les remplace.
//
// Usage :
//   node scripts/update-a-propos-page.js            (aperçu, aucune écriture)
//   node scripts/update-a-propos-page.js --apply     (applique réellement le nouveau contenu)

require('dotenv').config({ path: require('path').join(__dirname, '../.env.migration') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');

const NEW_TITLE = 'À propos de ReparMonPhone';

const NEW_CONTENT_HTML = `<h1>À propos de ReparMonPhone</h1>

<p style="text-align:center;">
<img src="https://bjfmbrexkkpgwufdqkoy.supabase.co/storage/v1/object/public/products/2025/03/logo-repar-mon-phone-3.png" alt="ReparMonPhone" width="220" style="max-width:100%;height:auto;display:block;margin:0 auto 24px;" />
</p>

<p><strong>20 ans d'expérience dans la réparation de smartphones et tablettes</strong>, à Sainte-Maxime, dans le Golfe de Saint-Tropez.</p>

<h2>Un atelier de réparation, et des pièces pour réparer vous-même</h2>
<p>ReparMonPhone, c'est avant tout un atelier de réparation. Écran cassé, batterie fatiguée, connecteur de charge défectueux : nous réparons les téléphones et tablettes Apple, Samsung, Huawei, Xiaomi et bien d'autres marques, en atelier ou à domicile.</p>
<p>Vous préférez réparer votre appareil vous-même, ou vous êtes réparateur professionnel ? Nous vendons en ligne les mêmes pièces détachées que nous utilisons dans notre atelier — plus de 6 500 références en stock, pour plus de 600 modèles différents — expédiées sous 24h partout en France métropolitaine avec Chronopost.</p>

<h2>ReparMonPhone en quelques chiffres</h2>
<table style="width:100%;border-collapse:collapse;margin:24px 0 32px;" cellpadding="0" cellspacing="0">
<tr>
<td style="width:50%;text-align:center;vertical-align:top;padding:16px 8px;">
<p style="margin:0 0 4px;font-size:1.75rem;font-weight:700;color:#111827;">20 ans</p>
<p style="margin:0;color:#6b7280;">d'expérience</p>
</td>
<td style="width:50%;text-align:center;vertical-align:top;padding:16px 8px;">
<p style="margin:0 0 4px;font-size:1.75rem;font-weight:700;color:#111827;">750</p>
<p style="margin:0;color:#6b7280;">commandes livrées par an</p>
</td>
</tr>
<tr>
<td style="width:50%;text-align:center;vertical-align:top;padding:16px 8px;">
<p style="margin:0 0 4px;font-size:1.75rem;font-weight:700;color:#111827;">6 500+</p>
<p style="margin:0;color:#6b7280;">pièces en stock</p>
</td>
<td style="width:50%;text-align:center;vertical-align:top;padding:16px 8px;">
<p style="margin:0 0 4px;font-size:1.75rem;font-weight:700;color:#111827;">600+</p>
<p style="margin:0;color:#6b7280;">modèles couverts</p>
</td>
</tr>
</table>

<h2>Nous contacter</h2>
<p>Une question avant de commander, ou besoin d'un devis pour une réparation ? Notre équipe vous répond du lundi au samedi, de 9h à 18h.</p>
<ul>
<li>Téléphone : <a href="tel:+33783497262">07 83 49 72 62</a></li>
<li>Email : <a href="mailto:contact@reparmonphone.fr">contact@reparmonphone.fr</a></li>
<li>Atelier : Les Saquèdes, 83120 Sainte-Maxime</li>
</ul>

<p style="text-align:center;margin-top:32px;">
<a href="/boutique"><strong>Acheter une pièce détachée</strong></a>
&nbsp;·&nbsp;
<a href="/rdv"><strong>Prendre RDV réparation</strong></a>
&nbsp;·&nbsp;
<a href="/avis-verifies">Voir nos avis vérifiés</a>
</p>
`;

async function main() {
  const page = await prisma.page.findUnique({ where: { slug: 'a-propos' } });
  if (!page) {
    console.log('❌ Aucune page trouvée avec le slug "a-propos" — rien à mettre à jour.');
    return;
  }

  console.log(`Titre actuel   : ${page.title}`);
  console.log(`Nouveau titre  : ${NEW_TITLE}`);
  console.log(`\nNouveau contenu (aperçu, ${NEW_CONTENT_HTML.length} caractères) :\n`);
  console.log(NEW_CONTENT_HTML);

  if (APPLY) {
    await prisma.page.update({
      where: { slug: 'a-propos' },
      data: { title: NEW_TITLE, contentHtml: NEW_CONTENT_HTML },
    });
    console.log('\n✅ Page "À propos" mise à jour.');
  } else {
    console.log('\nAperçu uniquement — relance avec --apply pour appliquer réellement ce contenu.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
