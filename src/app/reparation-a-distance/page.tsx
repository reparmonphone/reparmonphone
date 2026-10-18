import RepairByMailForm from './RepairByMailForm';
import JsonLd from '@/components/JsonLd';
import { prisma } from '@/lib/prisma';
import { PRIX_REPARATIONS } from '@/data/reparationPrix';

// Page publique : recalculée au plus une fois par heure (la note Google affichée en haut de page
// vient de la base) — pas de requête base à chaque visite.
export const revalidate = 3600;

export const metadata = {
  title: 'Réparation de téléphone à distance / par correspondance — Chronopost, Colissimo | ReparMonPhone',
  description:
    "Pas de réparateur près de chez vous ? Faites réparer votre téléphone à distance, par correspondance : envoyez-le par Chronopost ou Colissimo recommandé, on le répare à Sainte-Maxime et on vous le renvoie sous 24h. Devis gratuit, paiement uniquement après diagnostic.",
  alternates: { canonical: 'https://www.reparmonphone.fr/reparation-a-distance' },
};

const STEPS = [
  {
    icon: '📝',
    title: '1. Décrivez votre panne',
    text: "Remplissez le formulaire ci-dessous avec votre modèle et le problème rencontré. On vous répond sous 24h.",
  },
  {
    icon: '💶',
    title: '2. Vous recevez un devis et l\'adresse',
    text: "On vous envoie un devis par email. Vous l'acceptez ou le refusez en ligne, sans rien payer. Important : n'envoyez rien avant d'avoir reçu l'adresse d'envoi.",
  },
  {
    icon: '📦',
    title: '3. Envoyez votre appareil',
    text: "Par Chronopost ou Colissimo recommandé, bien protégé, à l'adresse confirmée par email. Vous indiquez votre numéro de suivi sur votre page de suivi.",
  },
  {
    icon: '🔍',
    title: '4. Diagnostic à réception',
    text: "On confirme la panne en ouvrant l'appareil et on vous prévient par email dès qu'il est reçu.",
  },
  {
    icon: '💳',
    title: '5. Paiement après diagnostic',
    text: "Vous recevez un lien de paiement sécurisé. Rien n'est débité avant, et l'appareil n'est renvoyé qu'après règlement.",
  },
  {
    icon: '🔧',
    title: '6. Réparation',
    text: "Réparation avec des pièces neuves ou d'origine, en général en moins d'une heure. Des photos de l'appareil réparé sont ajoutées à votre page de suivi.",
  },
  {
    icon: '✅',
    title: '7. Renvoi Chronopost 24h',
    text: "On vous renvoie votre appareil en Chronopost 24h avec un lien de suivi par email. Les frais de renvoi sont toujours inclus dans le prix annoncé.",
  },
];

// Version courte pour le haut de page : l'étape + ce qui se passe à ce moment-là.
const STEPS_SHORT = [
  { icon: '📝', label: 'Demande', note: 'Réponse sous 24h' },
  { icon: '💶', label: 'Devis', note: 'Accepté en ligne' },
  { icon: '📦', label: 'Envoi', note: 'Chronopost ou Colissimo' },
  { icon: '🔍', label: 'Diagnostic', note: 'À réception' },
  { icon: '💳', label: 'Paiement', note: 'Après diagnostic' },
  { icon: '🔧', label: 'Réparation', note: 'En général < 1 h' },
  { icon: '✅', label: 'Retour', note: 'Chronopost 24h, port inclus' },
];

// Les 4 questions que se posent les clients avant de commander (étude MiroFish n°2) : où est mon
// appareil, le prix peut-il changer, mes données sont-elles protégées, quand le récupère-je.
const ENGAGEMENTS = [
  {
    icon: '🔎',
    title: 'Vous savez toujours où il en est',
    points: [
      'Page de suivi en ligne : demande, envoi, diagnostic, paiement, réparation, renvoi.',
      'Un email à chaque étape clé : devis, appareil reçu, renvoi expédié.',
      'Lien de suivi Chronopost pour le colis retour, et photos de l\'appareil réparé.',
    ],
  },
  {
    icon: '💶',
    title: 'Pas de surprise sur le prix',
    points: [
      'Estimation gratuite et sans engagement.',
      "Vous acceptez ou refusez le devis en ligne avant d'envoyer quoi que ce soit. Si vous refusez, la demande est close sans aucun frais.",
      "Aucun paiement avant le diagnostic. L'appareil n'est renvoyé qu'après règlement.",
      'Renvoi Chronopost 24h toujours inclus dans le prix.',
    ],
  },
  {
    icon: '🔒',
    title: 'Vos données restent les vôtres',
    points: [
      'Nous n\'accédons ni à vos photos, ni à vos messages, ni à vos comptes. Nous ne copions ni ne conservons aucune donnée personnelle.',
      'Avant l\'envoi : faites une sauvegarde, désactivez « Localiser mon iPhone » ou le verrouillage du compte Google, retirez la carte SIM, la carte mémoire et la coque.',
      "Après la réparation : photos de l'appareil réparé sur votre page de suivi.",
    ],
  },
  {
    icon: '⏱️',
    title: 'Un délai clair, sans mauvaise surprise',
    points: [
      'Le « 24h » correspond au transport Chronopost du colis retour, compté à partir de son expédition.',
      "Réparation en général en moins d'une heure après réception. Au total, comptez 2 à 4 jours ouvrés (aller, réparation, retour).",
      'En cas de jour férié ou de pièce en rupture, on vous prévient avant, par email.',
    ],
  },
];

const FAQ = [
  {
    q: 'Qu\'est-ce que la réparation de téléphone par correspondance ?',
    a: 'C\'est un service qui permet de faire réparer son smartphone ou sa tablette sans se déplacer : vous décrivez la panne en ligne, vous envoyez l\'appareil par Chronopost ou Colissimo recommandé à notre atelier de Sainte-Maxime, et vous le récupérez réparé chez vous en Chronopost 24h. On parle aussi de "réparation à distance" ou "réparation par courrier".',
  },
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
  {
    q: 'Puis-je refuser le devis ?',
    a: "Oui. Le devis vous est envoyé par email avant tout envoi : vous l'acceptez ou le refusez en ligne. Si vous le refusez, la demande est close, vous n'envoyez rien et vous ne payez rien.",
  },
  {
    q: 'Mes données personnelles sont-elles en sécurité ?',
    a: "Nous n'accédons ni à vos photos, ni à vos messages, ni à vos comptes, et nous ne copions ni ne conservons de données personnelles. Par précaution, faites une sauvegarde avant l'envoi et désactivez « Localiser mon iPhone » ou le verrouillage du compte Google.",
  },
  {
    q: 'Que dois-je faire avant d\'envoyer mon téléphone ?',
    a: "Sauvegardez vos données, désactivez « Localiser mon iPhone » (ou le verrouillage du compte Google), retirez la carte SIM, la carte mémoire et la coque, puis emballez l'appareil dans un colis bien protégé. N'envoyez rien avant d'avoir reçu l'adresse par email.",
  },
  {
    q: 'À partir de quand court le délai de 24h ?',
    a: "Le « 24h » est le délai de transport Chronopost du colis retour : il court à partir de l'expédition de votre appareil réparé, après règlement. Le délai total (aller, réparation, retour) est en général de 2 à 4 jours ouvrés. Un jour férié ou une pièce en rupture peut l'allonger : dans ce cas on vous prévient avant.",
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

// Service dédié (distinct du ElectronicsStore local défini dans layout.tsx) : signale explicitement
// à Google que cette prestation précise est disponible sur toute la France, pas seulement autour de
// Sainte-Maxime — important car le reste du site cible surtout une zone géographique locale.
const serviceSchema = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  serviceType: 'Réparation de téléphone et tablette par correspondance',
  name: 'Réparation de téléphone par correspondance (à distance)',
  description:
    "Envoi du smartphone ou de la tablette par Chronopost ou Colissimo recommandé, diagnostic et réparation à l'atelier de Sainte-Maxime, puis renvoi en Chronopost 24h, partout en France métropolitaine.",
  provider: {
    '@type': 'ElectronicsStore',
    name: 'ReparMonPhone',
    url: 'https://www.reparmonphone.fr',
  },
  areaServed: { '@type': 'Country', name: 'France' },
  url: 'https://www.reparmonphone.fr/reparation-a-distance',
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Accueil', item: 'https://www.reparmonphone.fr' },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'Réparation par correspondance',
      item: 'https://www.reparmonphone.fr/reparation-a-distance',
    },
  ],
};

async function getGoogleRating() {
  try {
    const settings = await prisma.siteSetting.findMany({
      where: { key: { in: ['google_reviews_total', 'google_reviews_average'] } },
    });
    const total = Number(settings.find((x) => x.key === 'google_reviews_total')?.value);
    const average = Number(settings.find((x) => x.key === 'google_reviews_average')?.value);
    if (!total || !average) return null;
    return { total, average };
  } catch {
    return null;
  }
}

export default async function ReparationADistancePage() {
  const rating = await getGoogleRating();

  return (
    <div>
      <JsonLd data={faqSchema} />
      <JsonLd data={serviceSchema} />
      <JsonLd data={breadcrumbSchema} />

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

          {/* Preuves de confiance visibles dès le premier écran */}
          <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-gray-700">
            {rating && (
              <li>
                <a href="/avis-verifies" className="hover:underline">
                  <span className="text-amber-500">★</span> {rating.average.toFixed(1).replace('.', ',')}/5 ·{' '}
                  {rating.total} avis Google
                </a>
              </li>
            )}
            <li>🔎 Suivi en ligne, étape par étape</li>
            <li>📸 Photos de l&apos;appareil réparé</li>
            <li>
              <a
                href="https://fr.trustpilot.com/review/reparmonphone.fr"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                <span className="text-[#00b67a]">★</span> Avis Trustpilot
              </a>
            </li>
          </ul>
        </div>

        {/* Parcours complet visible dès le premier écran */}
        <div className="max-w-5xl mx-auto px-4 mt-10">
          <ol className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
            {STEPS_SHORT.map((s, i) => (
              <li key={s.label} className="bg-white border border-gray-100 rounded-xl px-2 py-3 text-center">
                <div className="text-xl">{s.icon}</div>
                <p className="text-sm font-semibold text-gray-800 mt-1">
                  {i + 1}. {s.label}
                </p>
                <p className="text-[11px] text-gray-500 leading-tight mt-0.5">{s.note}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Les 4 réponses que les clients cherchent avant de commander */}
      <section className="max-w-5xl mx-auto px-4 pt-14">
        <h2 className="text-2xl font-bold text-center text-gray-900 mb-2">Ce que vous devez savoir avant de commander</h2>
        <p className="text-center text-gray-500 mb-8">Où est mon appareil, le prix peut-il changer, mes données, le délai.</p>
        <div className="grid md:grid-cols-2 gap-5">
          {ENGAGEMENTS.map((e) => (
            <div key={e.title} className="bg-white border border-gray-100 rounded-xl p-5">
              <h3 className="font-semibold text-gray-900 mb-3">
                <span className="mr-2">{e.icon}</span>
                {e.title}
              </h3>
              <ul className="space-y-2 text-sm text-gray-600 list-disc pl-5">
                {e.points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {PRIX_REPARATIONS.length > 0 && (
          <div className="mt-6 bg-white border border-gray-100 rounded-xl p-5">
            <h3 className="font-semibold text-gray-900 mb-3">💶 Prix indicatifs des pannes courantes</h3>
            <ul className="divide-y divide-gray-100 text-sm">
              {PRIX_REPARATIONS.map((r) => (
                <li key={r.label} className="flex justify-between gap-4 py-2">
                  <span className="text-gray-700">{r.label}</span>
                  <span className="font-medium text-gray-900 shrink-0">{r.prix}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-gray-500 mt-3">
              Prix TTC, renvoi Chronopost 24h inclus. Le devis exact vous est envoyé après votre demande, et vous
              restez libre de le refuser.
            </p>
          </div>
        )}
      </section>

      <section className="max-w-5xl mx-auto px-4 py-14">
        <h2 className="text-2xl font-bold text-center text-gray-900 mb-10">Comment ça marche</h2>
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-6">
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
