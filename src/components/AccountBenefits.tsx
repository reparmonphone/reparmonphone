import Link from 'next/link';

// Pourquoi un compte est demandé pour commander : à afficher là où le client hésite (panier non
// connecté, inscription). Composant sans état : utilisable dans une page serveur comme cliente.
// N'affirme que ce que le site fait réellement (suivi des commandes, factures, litiges, adresse
// pré-remplie, panier conservé, protection des données).

const BENEFITS = [
  { icon: '📦', text: 'Suis ta commande en direct : statut et numéro de suivi du colis' },
  { icon: '🧾', text: 'Retrouve toutes tes factures quand tu en as besoin' },
  { icon: '🔁', text: 'Recommande plus vite : ton adresse est déjà enregistrée' },
  { icon: '🛟', text: 'En cas de souci, on retrouve ta commande tout de suite pour t’aider' },
];

export default function AccountBenefits({
  compact = false,
  showPrivacy = true,
  className = '',
}: {
  compact?: boolean;
  showPrivacy?: boolean;
  className?: string;
}) {
  const items = compact ? BENEFITS.slice(0, 3) : BENEFITS;

  return (
    <div className={`bg-brand-light border border-brand/20 rounded-xl px-4 py-4 text-left ${className}`}>
      <p className="text-sm font-semibold text-brand-dark mb-2">Pourquoi un compte, c&apos;est mieux pour toi</p>
      <ul className="space-y-1.5 text-sm text-gray-700">
        {items.map((b) => (
          <li key={b.text} className="flex gap-2">
            <span aria-hidden="true">{b.icon}</span>
            <span>{b.text}</span>
          </li>
        ))}
      </ul>
      {showPrivacy && (
        <p className="text-xs text-gray-500 mt-3 leading-relaxed">
          🔒 Tes données restent chez nous : elles ne sont ni revendues ni partagées avec des régies publicitaires, et
          tes données bancaires ne sont jamais stockées sur nos serveurs.{' '}
          <Link href="/confidentialite" className="underline hover:text-brand">
            Politique de confidentialité
          </Link>
        </p>
      )}
    </div>
  );
}
