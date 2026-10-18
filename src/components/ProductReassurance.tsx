import Link from 'next/link';
import { GARANTIE_PIECES, DELAI_RETOUR } from '@/data/reassurance';

// Bloc affiché sous le bouton « Ajouter au panier » : répond aux 3 doutes qui bloquent les clients
// « convaincus mais instables » (étude MiroFish n°1) — est-ce compatible avec mon modèle, que se
// passe-t-il si ça ne convient pas, et comment être sûr de bien faire.
export default function ProductReassurance({
  brand,
  modelName,
  guide,
}: {
  brand: string;
  modelName: string;
  guide?: { slug: string; title: string } | null;
}) {
  const garantie = GARANTIE_PIECES ? `Garantie ${GARANTIE_PIECES}` : 'Garantie';
  const retour = DELAI_RETOUR ? `retours sous ${DELAI_RETOUR}` : 'conditions de retour';

  return (
    <ul className="mt-4 space-y-2 rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-700">
      <li className="flex gap-2">
        <span aria-hidden="true">✅</span>
        <span>
          <strong className="font-semibold text-gray-900">Compatible avec : {brand} {modelName}.</strong> Un doute sur
          votre modèle exact ?{' '}
          <Link href="/contact" className="text-brand hover:underline">
            Écrivez-nous avant de commander
          </Link>
          .
        </span>
      </li>
      <li className="flex gap-2">
        <span aria-hidden="true">🛡️</span>
        <span>
          {garantie} et {retour} :{' '}
          <Link href="/livraison-retours" className="text-brand hover:underline">
            voir le détail
          </Link>
          .
        </span>
      </li>
      {guide && (
        <li className="flex gap-2">
          <span aria-hidden="true">🔧</span>
          <span>
            Pas à pas pour poser la pièce :{' '}
            <Link href={`/reparation/guide/${guide.slug}`} className="text-brand hover:underline">
              {guide.title}
            </Link>
          </span>
        </li>
      )}
      <li className="flex gap-2">
        <span aria-hidden="true">💳</span>
        <span>Paiement sécurisé. Livraison Chronopost 24h en France métropolitaine.</span>
      </li>
    </ul>
  );
}
