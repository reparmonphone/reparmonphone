import Image from 'next/image';

const REASONS = [
  { icon: '📍', text: 'Implantation locale forte à Sainte-Maxime (Golfe de Saint-Tropez)' },
  { icon: '🚚', text: 'Vente de pièces détachées en ligne, livraison 24h en France' },
  { icon: '🔧', text: 'Réparations express avec prise de rendez-vous en ligne' },
  { icon: '💰', text: 'Tarifs compétitifs & qualité garantie' },
  { icon: '📅', text: '30 ans d\u2019expertise dans la réparation de téléphones' },
  { icon: '👍', text: 'Une réputation solide basée sur la confiance et la satisfaction' },
];

export default function ReparActeursSection() {
  return (
    <section className="max-w-6xl mx-auto px-4 py-12">
      <div className="grid md:grid-cols-2 gap-10 items-stretch">
        {/* Colonne gauche : logo Repar'Acteurs PACA (seul, sans le bandeau texte) + texte */}
        <div className="flex flex-col">
          <div className="relative w-full flex-1 min-h-[320px] mb-6">
            <Image
              src="/partners/repar-acteurs-paca-logo-only.png"
              alt="Repar'Acteurs PACA — certification ReparMonPhone"
              fill
              className="object-contain"
            />
          </div>
          <h2 className="text-xl font-extrabold text-gray-900 mb-4">🔟 Pourquoi Choisir ReparMonPhone ?</h2>
          <ul className="space-y-3">
            {REASONS.map((r) => (
              <li key={r.text} className="flex items-start gap-3 text-gray-700">
                <span className="text-lg shrink-0">{r.icon}</span>
                <span>{r.text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Colonne droite : GIF animé + légende marques */}
        <div className="flex flex-col">
          <div className="relative w-full flex-1 min-h-[320px] rounded-xl overflow-hidden bg-gray-50">
            <Image
              src="/partners/reparmonphone-animation.gif"
              alt="ReparMonPhone — réparation et pièces détachées"
              fill
              unoptimized
              className="object-contain"
            />
          </div>
          <p className="text-center text-lg font-bold text-gray-800 mt-6">Apple, Samsung, Huawei, Xiaomi...</p>
        </div>
      </div>

      {/* Vidéo Repar'Acteurs PACA, pleine largeur, lecture automatique */}
      <div className="mt-10 rounded-xl overflow-hidden bg-black">
        <video
          src="/videos/repar-acteurs-paca.mp4"
          controls
          autoPlay
          muted
          loop
          playsInline
          className="w-full"
        />
      </div>
    </section>
  );
}
