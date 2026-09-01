export const metadata = { title: 'Avis Vérifiés' };

export default function AvisVerifiesPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-16">
      <div className="flex items-center gap-3 mb-6">
        <ShieldIcon />
        <h1 className="text-2xl font-bold text-gray-900">Avis Vérifiés</h1>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl p-6 space-y-4 text-gray-700 leading-relaxed">
        <p>
          Sur ReparMonPhone, le badge <strong>"✔️ Achat vérifié"</strong> qui accompagne certains avis produits
          garantit que la personne ayant laissé cet avis a réellement acheté ce produit sur notre site, et que
          sa commande a bien été livrée.
        </p>

        <div className="bg-brand-light border border-brand/20 rounded-lg p-4">
          <p className="font-semibold text-brand-dark mb-1">Depuis quand ?</p>
          <p className="text-sm">
            Ce système de vérification est en place depuis <strong>août 2026</strong>. Les avis publiés avant
            cette date (notamment ceux importés depuis notre historique de plus de 15 ans d&apos;activité)
            n&apos;ont pas pu être vérifiés de cette façon et n&apos;affichent donc pas ce badge — cela ne
            signifie pas qu&apos;ils sont moins authentiques, simplement que ce contrôle automatique n&apos;existait
            pas encore à l&apos;époque.
          </p>
        </div>

        <div>
          <p className="font-semibold text-gray-800 mb-1">Comment un avis devient-il "vérifié" ?</p>
          <ul className="list-disc list-inside text-sm space-y-1">
            <li>Le client doit être connecté à son compte ReparMonPhone.</li>
            <li>Il doit avoir passé commande du produit concerné directement sur notre site.</li>
            <li>Sa commande doit être passée au statut "Livrée".</li>
            <li>Un seul avis vérifié possible par client et par produit.</li>
          </ul>
        </div>

        <p className="text-sm text-gray-500">
          Nous appliquons ce contrôle pour garantir à nos visiteurs des retours fiables et représentatifs de
          l&apos;expérience réelle de nos clients.
        </p>
      </div>
    </div>
  );
}

function ShieldIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 2L4 5v6c0 5.5 3.4 10.2 8 11.5 4.6-1.3 8-6 8-11.5V5l-8-3z"
        fill="#0E7FDB"
      />
      <path
        d="M9 12.5l2 2 4-4.5"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
