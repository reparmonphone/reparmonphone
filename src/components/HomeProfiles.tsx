import Link from 'next/link';

// Trois entrées pour trois types de visiteurs (étude MiroFish n°1) : celui qui est pressé, celui qui
// compare les prix, et celui qui hésite sur la pièce à prendre.
const PROFILES = [
  {
    icon: '🚨',
    title: "J'en ai besoin vite",
    text: 'Commandez avant 20h : livraison estimée sous 24h par Chronopost, en France métropolitaine.',
    href: '/boutique',
    cta: 'Voir les pièces en stock',
  },
  {
    icon: '💶',
    title: 'Je veux le meilleur prix',
    text: "Pour une même pièce, comparez les qualités disponibles (origine ou compatible) et choisissez celle qui vous convient.",
    href: '/boutique',
    cta: 'Comparer les pièces',
  },
  {
    icon: '🤔',
    title: 'Je ne sais pas quoi prendre',
    text: 'Suivez un guide de réparation pas à pas, écrivez-nous, ou faites-vous réparer en atelier ou par correspondance.',
    href: '/reparation',
    cta: 'Voir les guides',
  },
];

export default function HomeProfiles() {
  return (
    <section className="max-w-6xl mx-auto px-4 py-10">
      <h2 className="text-2xl font-bold text-center text-gray-900 mb-6">De quoi avez-vous besoin aujourd&apos;hui&nbsp;?</h2>
      <div className="grid md:grid-cols-3 gap-4">
        {PROFILES.map((p) => (
          <Link
            key={p.title}
            href={p.href}
            className="block bg-white border border-gray-100 rounded-xl p-5 hover:border-brand hover:shadow-md transition"
          >
            <div className="text-3xl mb-2" aria-hidden="true">
              {p.icon}
            </div>
            <h3 className="font-semibold text-gray-900">{p.title}</h3>
            <p className="text-sm text-gray-600 mt-1">{p.text}</p>
            <p className="text-sm font-medium text-brand mt-3">{p.cta} →</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
