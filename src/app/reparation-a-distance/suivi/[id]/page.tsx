import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import TrackingSubmitForm from './TrackingSubmitForm';
import MailInRepairStepper from '@/components/MailInRepairStepper';
import MailInRepairQuoteDecision from '@/components/MailInRepairQuoteDecision';

export const metadata = {
  title: 'Renseigner mon numéro de suivi — Réparation par correspondance | ReparMonPhone',
  robots: { index: false },
};

export default async function SuiviMailInRepairPage({ params }: { params: { id: string } }) {
  const repair = await prisma.mailInRepair.findUnique({
    where: { id: params.id },
    include: { replies: { orderBy: { createdAt: 'desc' } } },
  });
  if (!repair) notFound();

  const latestQuote = repair.replies.find((r) => r.quotedEstimate != null);
  const hasPendingQuote = !!latestQuote && repair.quoteDecision === null;

  // Par sécurité : ce lien n'est censé être envoyé qu'une fois la demande validée (adresse
  // communiquée). S'il est ouvert avant, on affiche un message d'attente plutôt que le formulaire.
  if (!repair.repliedAt) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="text-5xl mb-4">⏳</div>
        <h1 className="text-2xl font-bold mb-3">Demande pas encore validée</h1>
        <p className="text-gray-600">
          Votre demande concernant votre <strong>{repair.deviceBrand} {repair.deviceModel}</strong> est
          en cours de traitement. Vous recevrez un email avec l'adresse d'envoi et ce lien dès qu'elle
          sera validée — pas besoin d'agir pour le moment.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-12">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold mb-2">Suivi de votre réparation</h1>
        <p className="text-gray-500">{repair.deviceBrand} {repair.deviceModel}</p>
      </div>

      {repair.status === 'CANCELLED' ? (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700 text-center">
          Cette demande a été annulée. Une question ? Appelez-nous au{' '}
          <a href="tel:+33783497262" className="underline">07 83 49 72 62</a>.
        </div>
      ) : (
        <div className="mb-8">
          <MailInRepairStepper status={repair.status} />
        </div>
      )}

      {hasPendingQuote && (
        <div className="mb-6">
          <MailInRepairQuoteDecision repairId={repair.id} amount={Number(latestQuote!.quotedEstimate)} />
        </div>
      )}

      {repair.repairedPhotos.length > 0 && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-green-800 mb-2">📸 Votre appareil réparé</p>
          <div className="flex flex-wrap gap-2">
            {repair.repairedPhotos.map((url) => (
              <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                <img src={url} alt="" className="w-24 h-24 object-cover rounded-lg border border-green-200 hover:opacity-80 transition" />
              </a>
            ))}
          </div>
        </div>
      )}

      {!hasPendingQuote && (
        <TrackingSubmitForm
          repairId={repair.id}
          initialTrackingNumber={repair.inboundTrackingNumber}
          initialCarrier={repair.inboundCarrier}
        />
      )}

      <p className="text-xs text-gray-400 text-center mt-6">
        Une fois votre appareil réceptionné, on met à jour votre statut ci-dessus. Une question ?
        Appelez-nous au <a href="tel:+33783497262" className="text-brand hover:underline">07 83 49 72 62</a>.
      </p>
    </div>
  );
}
