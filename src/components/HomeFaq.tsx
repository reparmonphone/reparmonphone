import JsonLd from '@/components/JsonLd';
import { getFreeShippingConfig } from '@/lib/freeShipping';

// FAQ de la page d'accueil. Le texte affiché et le JSON-LD (FAQPage) viennent de la même liste :
// Google et les assistants IA lisent exactement ce que voit le client.
export default async function HomeFaq() {
  const shipping = await getFreeShippingConfig();

  const faq: { q: string; a: string }[] = [
    {
      q: 'Combien de temps prend la livraison, et jusqu’à quelle heure commander ?',
      a: `Toutes les commandes sont expédiées par Chronopost, avec une livraison estimée sous 24h pour la majorité du territoire métropolitain. Commandez avant 20h pour être livré le lendemain.${
        shipping.enabled ? ` La livraison est offerte à partir de ${shipping.threshold} € d’achat.` : ''
      }`,
    },
    {
      q: 'Où et comment réparez-vous mon téléphone ?',
      a: 'Trois possibilités : en atelier à Sainte-Maxime, à domicile dans tout le Golfe de Saint-Tropez, ou par correspondance partout en France métropolitaine. Pour une intervention à domicile, Sainte-Maxime est sans supplément et les autres villes du Golfe ont des frais de déplacement indiqués dans la section « Zones desservies ».',
    },
    {
      q: 'Comment fonctionne la réparation par correspondance ?',
      a: 'Vous décrivez la panne en ligne, puis vous envoyez votre appareil par Chronopost ou Colissimo recommandé à l’adresse confirmée par email. Après diagnostic, vous recevez un lien de paiement sécurisé. Une fois le règlement effectué, on vous renvoie l’appareil réparé en Chronopost 24h, frais de renvoi inclus dans le prix annoncé.',
    },
    {
      q: 'Dois-je payer avant d’envoyer mon appareil ?',
      a: 'Non. Vous n’envoyez rien avant d’avoir reçu la confirmation de l’adresse par email, et le lien de paiement sécurisé n’est envoyé qu’une fois le diagnostic confirmé. L’appareil n’est renvoyé qu’après règlement.',
    },
    {
      q: 'Quelles marques réparez-vous et quelles pièces proposez-vous ?',
      a: 'Nous réparons et vendons des pièces détachées pour Apple, Samsung, Huawei et Xiaomi, et d’autres marques sur demande : écrans, batteries et autres pièces pour smartphones et tablettes.',
    },
  ];

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  return (
    <section className="bg-white py-12 border-t border-gray-100" aria-labelledby="faq-accueil">
      <JsonLd data={schema} />
      <div className="max-w-3xl mx-auto px-4">
        <h2 id="faq-accueil" className="text-2xl font-bold text-gray-900 text-center mb-6">
          Questions fréquentes
        </h2>
        <div className="space-y-3">
          {faq.map((f, i) => (
            <details
              key={f.q}
              open={i === 0}
              className="group bg-gray-50 border border-gray-100 rounded-xl open:bg-brand-light/50 open:border-brand/30 transition-colors"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-semibold text-gray-900 [&::-webkit-details-marker]:hidden">
                <span>{f.q}</span>
                <svg
                  className="h-5 w-5 shrink-0 text-brand transition-transform duration-300 group-open:rotate-180"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </summary>
              <p className="px-5 pb-5 text-gray-600 leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
