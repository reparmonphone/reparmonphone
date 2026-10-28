import type { Metadata } from 'next';
import Link from 'next/link';
import { verifyUnsubToken } from '@/lib/marketing';
import { confirmUnsubscribe } from './actions';

export const metadata: Metadata = {
  title: 'Désinscription des e-mails',
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';

export default function DesinscriptionPage({ searchParams }: { searchParams: { e?: string; t?: string; fait?: string; erreur?: string } }) {
  const email = (searchParams.e ?? '').trim();
  const valid = !!email && verifyUnsubToken(email, searchParams.t ?? '');

  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <h1 className="text-2xl font-bold mb-3">Désinscription</h1>
      {searchParams.fait ? (
        <>
          <p className="text-gray-700 mb-2">✅ C&apos;est fait : vous ne recevrez plus d&apos;e-mails promotionnels de ReparMonPhone.</p>
          <p className="text-sm text-gray-500 mb-6">Vous continuerez à recevoir les e-mails liés à vos commandes et rendez-vous.</p>
          <Link href="/" className="text-brand font-medium hover:underline">Retour au site</Link>
        </>
      ) : valid ? (
        <form action={confirmUnsubscribe} className="bg-white border border-gray-100 rounded-xl p-6">
          <p className="text-gray-700 mb-1">Ne plus recevoir nos offres par e-mail à l&apos;adresse :</p>
          <p className="font-semibold mb-5 break-all">{email}</p>
          <input type="hidden" name="e" value={email} />
          <input type="hidden" name="t" value={searchParams.t} />
          <button type="submit" className="bg-brand text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-brand-dark transition">
            Confirmer la désinscription
          </button>
          <p className="text-xs text-gray-400 mt-4">Les e-mails liés à vos commandes (confirmation, suivi) ne sont pas concernés.</p>
        </form>
      ) : (
        <>
          <p className="text-gray-700 mb-2">Ce lien de désinscription n&apos;est pas valide ou a expiré.</p>
          <p className="text-sm text-gray-500 mb-6">
            Pour ne plus recevoir nos offres, écrivez-nous à{' '}
            <a href="mailto:contact@reparmonphone.fr" className="text-brand hover:underline">contact@reparmonphone.fr</a>.
          </p>
          <Link href="/" className="text-brand font-medium hover:underline">Retour au site</Link>
        </>
      )}
    </div>
  );
}
