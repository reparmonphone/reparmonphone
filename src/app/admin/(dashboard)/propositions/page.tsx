import { listProposals } from '@/lib/proposal';
import { parisToday } from '@/lib/seasonalThemes';
import ProposalManager from './ProposalManager';

export const dynamic = 'force-dynamic';

export default async function AdminPropositionsPage() {
  let proposals: Awaited<ReturnType<typeof listProposals>> = [];
  try {
    proposals = await listProposals();
  } catch {
    // base indisponible : on affiche quand même le formulaire
  }
  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-bold mb-1">🧾 Propositions clients</h1>
      <p className="text-gray-500 mb-6">
        Un client demande un tarif ? Compose son panier (pièces, avec ou sans main d’œuvre) et envoie-lui par e-mail : il voit le détail
        et, d’un clic, ses pièces arrivent dans son panier.
      </p>
      <ProposalManager proposals={proposals} today={parisToday()} />
    </div>
  );
}
