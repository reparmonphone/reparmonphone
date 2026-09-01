const BADGES = [
  { icon: '🚚', title: 'Livraison Rapide', subtitle: '24h Chronopost' },
  { icon: '💳', title: 'Paiements Sécurisés', subtitle: 'Visa, Mastercard' },
  { icon: '↩️', title: '14 Jours Retours', subtitle: 'Achetez en toute confiance' },
  { icon: '🎧', title: 'Support Réactif', subtitle: 'Lun–Sam 9h–18h · Écrivez-nous' },
];

export default function TrustBadgesBar() {
  return (
    <section className="border-y border-gray-100 bg-white">
      <div className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-2 md:grid-cols-4 gap-6">
        {BADGES.map((b) => (
          <div key={b.title} className="flex items-center gap-3">
            <span className="text-3xl shrink-0">{b.icon}</span>
            <div>
              <p className="font-semibold text-sm text-gray-800">{b.title}</p>
              <p className="text-xs text-gray-500">{b.subtitle}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
