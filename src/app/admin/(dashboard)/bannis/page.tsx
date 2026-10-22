import { requireAdminUser } from '@/lib/supabase-server';
import { loadBanEntries } from '@/lib/bannedClients';
import BannedManager from './BannedManager';

export const dynamic = 'force-dynamic';

export default async function AdminBannisPage() {
  await requireAdminUser();
  const entries = await loadBanEntries({ fresh: true });
  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-1">🚫 Clients bannis</h1>
      <p className="text-gray-500 mb-6 text-sm">
        Un client banni ne peut plus rien faire sur le site : commander, prendre rendez-vous, écrire par le formulaire de
        contact, ouvrir un litige, laisser un avis, créer un compte, se connecter ou réinitialiser son mot de passe. Il est reconnu par son compte, son
        e-mail, son téléphone, son adresse IP ou son adresse postale — changer d&apos;e-mail ne suffit donc pas.
        Il n&apos;est jamais prévenu : ses formulaires affichent une erreur banale (ou semblent réussir pour le contact et la
        newsletter), et il ne reçoit plus aucun e-mail du site. La navigation (voir les produits) reste possible.
      </p>
      <BannedManager initial={entries} />
    </div>
  );
}
