export const metadata = { title: 'Maintenance en cours | ReparMonPhone' };

export default function MaintenancePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-brand-light to-white px-4">
      <div className="max-w-lg w-full text-center">
        <MaintenanceIllustration />

        <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 mt-8 mb-3">
          On répare aussi notre site !
        </h1>
        <p className="text-gray-600 leading-relaxed mb-6">
          ReparMonPhone est actuellement en maintenance pour quelques instants. On revient très vite — merci de
          ta patience !
        </p>

        <div className="bg-white border border-gray-100 rounded-xl p-5 inline-block">
          <p className="text-sm text-gray-500 mb-1">Besoin de nous contacter en attendant ?</p>
          <a href="tel:+33783497262" className="text-brand font-semibold hover:underline">
            📞 07 83 49 72 62
          </a>
        </div>
      </div>
    </div>
  );
}

function MaintenanceIllustration() {
  return (
    <svg viewBox="0 0 400 300" className="w-full max-w-sm mx-auto" xmlns="http://www.w3.org/2000/svg">
      {/* Fond décoratif */}
      <circle cx="200" cy="150" r="120" fill="#E6F3FC" />

      {/* Téléphone */}
      <rect x="150" y="70" width="100" height="180" rx="16" fill="#1f2937" />
      <rect x="160" y="90" width="80" height="140" rx="4" fill="#0E7FDB" />
      <circle cx="200" cy="238" r="6" fill="#374151" />

      {/* Écran cassé stylisé (lignes) */}
      <path d="M175 110 L200 140 L185 160 L215 190" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" />

      {/* Clé à molette */}
      <g transform="rotate(25 290 190)">
        <rect x="275" y="150" width="14" height="80" rx="6" fill="#F59E0B" />
        <circle cx="282" cy="145" r="20" fill="#F59E0B" />
        <circle cx="282" cy="145" r="10" fill="#E6F3FC" />
      </g>

      {/* Tournevis */}
      <g transform="rotate(-20 110 190)">
        <rect x="103" y="150" width="10" height="70" rx="4" fill="#6B7280" />
        <rect x="98" y="120" width="20" height="35" rx="3" fill="#0E7FDB" />
      </g>

      {/* Étincelles / réglages */}
      <circle cx="120" cy="90" r="6" fill="#F59E0B" />
      <circle cx="290" cy="100" r="4" fill="#0E7FDB" />
      <circle cx="310" cy="230" r="5" fill="#F59E0B" />

      {/* Engrenage */}
      <g transform="translate(90 220)">
        <circle cx="0" cy="0" r="18" fill="#0E7FDB" />
        <circle cx="0" cy="0" r="8" fill="#E6F3FC" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
          <rect
            key={angle}
            x="-3"
            y="-24"
            width="6"
            height="10"
            fill="#0E7FDB"
            transform={`rotate(${angle})`}
          />
        ))}
      </g>
    </svg>
  );
}
