import RepairByMailForm from './RepairByMailForm';
import JsonLd from '@/components/JsonLd';

export const metadata = {
  title: 'Réparation de téléphone par correspondance — Chronopost ou Colissimo | ReparMonPhone',
  description:
    "Pas de réparateur près de chez vous ? Envoyez votre téléphone par Chronopost ou Colissimo recommandé, on le répare et on vous le renvoie sous 24h après réparation. Devis gratuit, paiement uniquement après diagnostic.",
  alternates: { canonical: 'https://www.reparmonphone.fr/reparation-a-distance' },
};

const STEPS = [
  {
    icon: '📝',
    title: '1. Décrivez votre panne',
    text: "Remplissez le formulaire ci-dessous avec votre modèle et le problème rencontré. On vous répond sous 24h avec une estimation.",
  },
  {
    icon: '📮',
    title: "2. On valide votre demande et on vous donne l'adresse",
    text: "Après échange avec vous, on vous communique l'adresse d'envoi exacte par email. Important : n'envoyez rien avant de l'avoir reçue.",
  },
  {
    icon: '📦',
    title: '3. Envoyez votre appareil',
    text: 'Vous nous envoyez votre téléphone par Chronopost ou Colissimo recommandé, bien protégé, à l\'adresse confirmée par email.',
  },
  {
    icon: '🔧',
    title: '4. Diagnostic et réparation',
    text: 'On confirme le prix exact après avoir ouvert l\'appareil, puis on procède à la réparation avec des pièces neuves ou d\'origine.',
  },
  {
    icon: '✅',
    title: '5. Renvoi Chronopost 24h',
    text: 'Une fois le paiement réglé, on vous renvoie votre appareil réparé en Chronopost 24h. Les frais de renvoi sont toujours inclus dans le prix annoncé, jamais facturés à part.',
  },
];

const FAQ = [
  {
    q: "Dans quelle ville dois-je habiter pour utiliser ce service ?",
    a: "Aucune ! C'est justement l'intérêt de la réparation par correspondance : que vous soyez à côté de Sainte-Maxime ou à l'autre bout de la France métropolitaine, vous nous envoyez votre appareil par Chronopost ou Colissimo recommandé et on vous le renvoie réparé, sans avoir à trouver un réparateur près de chez vous.",
  },
  {
    q: 'Combien coûte le renvoi de mon appareil réparé ?',
    a: "Rien de plus que le prix annoncé dans le devis : les frais de renvoi en Chronopost 24h sont toujours inclus dans le tarif de la réparation, jamais ajoutés en supplément au moment de l'envoi.",
  },
  {
    q: 'Dois-je payer avant d\'envoyer mon téléphone ?',
    a: "Non. Vous envoyez votre appareil sans avoir rien payé. On vous envoie un lien de paiement sécurisé uniquement une fois le diagnostic confirmé, et on ne renvoie l'appareil qu'après règlement.",
  },
  {
    q: "Où dois-je envoyer mon appareil ?",
    a: "Ne l'envoyez surtout pas avant d'avoir reçu notre confirmation ! L'adresse d'envoi exacte ne vous est communiquée qu'une fois votre demande validée, directement par email après échange avec vous. C'est volontaire : cela évite tout envoi à une mauvaise adresse.",
  },
  {
    q: 'Quelles réparations sont possibles par correspondance ?',
    a: "Écran cassé, batterie qui ne tient plus la charge, connecteur de charge, caméra, haut-parleur, bouton... la plupart des pannes courantes sur smartphones et tablettes Apple, Samsung, Huawei, Xiaomi et autres marques.",
  },
  {
    q: 'Combien de temps prend la réparation ?',
    a: 'La réparation elle-même prend généralement moins d\'une heure une fois l\'appareil reçu. Le délai total dépend surtout du transport aller (Chronopost ou Colissimo recommandé) et du retour en Chronopost 24h, en général 2 à 4 jours ouvrés au total.',
  },
];

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.map((item) => ({
    '@type': 'Question',
    name: item.q,
    acceptedAnswer: { '@type': 'Answer', text: item.a },
  })),
};

export default function ReparationADistancePage() {
  return (
    <div>
      <JsonLd data={faqSchema} />

      <section className="bg-gradient-to-b from-brand-light to-white py-14">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900">
            Pas de réparateur près de chez vous ? On répare votre téléphone par correspondance.
          </h1>
          <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
            Où que vous soyez en France métropolitaine, décrivez votre panne, on vous confirme une
            estimation et l'adresse d'envoi, vous nous expédiez l'appareil par Chronopost ou Colissimo
            recommandé, et on vous le renvoie réparé en Chronopost 24h — frais de renvoi toujours inclus dans le prix, jamais de
            mauvaise surprise.
          </p>
          <a
            href="#demande"
            className="inline-block mt-6 bg-brand text-white px-6 py-3 rounded-lg font-semibold hover:bg-brand-dark transition"
          >
            📮 Demander mon estimation gratuite
          </a>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 py-14">
        <h2 className="text-2xl font-bold text-center text-gray-900 mb-10">Comment ça marche</h2>
        <div className="grid sm:grid-cols-2 md:grid-cols-5 gap-6">
          {STEPS.map((step) => (
            <div key={step.title} className="bg-white border border-gray-100 rounded-xl p-5 text-center">
              <div className="text-3xl mb-3">{step.icon}</div>
              <h3 className="font-semibold text-gray-800 mb-2">{step.title}</h3>
              <p className="text-sm text-gray-500">{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-brand-light/40 py-14">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            Le bon réparateur n'est pas forcément à côté de chez vous
          </h2>
          <p className="text-gray-600">
            Beaucoup de villes et de villages n'ont aucun réparateur de téléphone fiable à proximité, ou
            uniquement des points relais qui envoient eux-mêmes l'appareil ailleurs pour la réparation.
            La réparation par correspondance vous évite ce détour : vous traitez directement avec l'atelier
            qui répare, à Sainte-Maxime, sans intermédiaire — et sans avoir à vous déplacer.
          </p>
        </div>
      </section>

      <section id="demande" className="max-w-2xl mx-auto px-4 py-14">
        <h2 className="text-2xl font-bold text-center text-gray-900 mb-2">Demander mon estimation gratuite</h2>
        <p className="text-gray-500 text-center mb-4">
          Sans engagement — vous ne payez rien avant qu'on ait reçu et diagnostiqué votre appareil.
        </p>
        <div className="mb-8 bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800 text-center">
          ⚠️ <strong>N'envoyez pas votre appareil tout de suite.</strong> L'adresse d'envoi vous sera
          communiquée uniquement après validation de votre demande, directement par email suite à un
          échange avec nous — pour éviter tout envoi à une adresse erronée.
        </div>
        <RepairByMailForm />
      </section>

      <section className="max-w-3xl mx-auto px-4 pb-16">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Questions fréquentes</h2>
        <div className="space-y-4">
          {FAQ.map((item) => (
            <details key={item.q} className="bg-white border border-gray-100 rounded-xl p-4 group">
              <summary className="font-medium text-gray-800 cursor-pointer list-none flex items-center justify-between">
                {item.q}
                <span className="text-gray-400 group-open:rotate-45 transition">+</span>
              </summary>
              <p className="text-sm text-gray-500 mt-3">{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
