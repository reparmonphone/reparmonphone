import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';
import MailInRepairStepper from '@/components/MailInRepairStepper';
import TrackingSubmitForm from '@/app/reparation-a-distance/suivi/[id]/TrackingSubmitForm';

const OUTBOUND_CARRIER_LABELS: Record<string, string> = {
  CHRONOPOST: 'Chronopost',
  COLISSIMO: 'Colissimo',
  MONDIAL_RELAY: 'Mondial Relay',
  RELAIS_COLIS: 'Relais Colis',
  AUTRE: 'transporteur',
};

export default async function MonReparationADistanceDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/compte/connexion?redirect=/compte/reparation-a-distance/${params.id}`);

  const repair = await prisma.mailInRepair.findUnique({ where: { id: params.id } });
  if (!repair) notFound();

  // Défense en profondeur : même si l'id (cuid) n'est pas devinable, on vérifie explicitement que
  // la demande appartient bien au client connecté avant de l'afficher dans son espace compte.
  const isOwner = repair.userId === user.id || (repair.userId === null && repair.customerEmail === user.email);
  if (!isOwner) notFound();

  return (
    <div className="max-w-xl mx-auto px-4 py-12">
      <Link href="/compte/reparation-a-distance" className="text-sm text-gray-400 hover:text-brand">
        ← Mes réparations par correspondance
      </Link>

      <div className="mt-4 mb-8 text-center">
        <h1 className="text-2xl font-bold mb-1">{repair.deviceBrand} {repair.deviceModel}</h1>
        <p className="text-gray-500 text-sm">Demande du {new Date(repair.createdAt).toLocaleDateString('fr-FR')}</p>
      </div>

      {repair.status === 'CANCELLED' ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700 text-center">
          Cette demande a été annulée. Une question ? Appelez-nous au{' '}
          <a href="tel:+33783497262" className="underline">07 83 49 72 62</a>.
        </div>
      ) : (
        <MailInRepairStepper status={repair.status} />
      )}

      {!repair.repliedAt && repair.status !== 'CANCELLED' && (
        <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800 text-center">
          On revient vers toi sous 24h avec une estimation et l&apos;adresse d&apos;envoi — pas besoin d&apos;agir
          pour le moment.
        </div>
      )}

      {repair.adminReply && (
        <div className="mt-6">
          <p className="text-xs text-gray-400 mb-1">Notre réponse</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg p-3">{repair.adminReply}</p>
        </div>
      )}

      {repair.quotedPrice && (
        <p className="mt-4 text-center text-lg font-bold">
          {Number(repair.quotedPrice).toFixed(2)} €{' '}
          <span className="text-sm font-normal text-gray-500">(renvoi Chronopost 24h inclus)</span>
        </p>
      )}

      {repair.repairedPhotos.length > 0 && (
        <div className="mt-6 bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-green-800 mb-2">📸 Ton appareil réparé</p>
          <div className="flex flex-wrap gap-2">
            {repair.repairedPhotos.map((url) => (
              <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                <img src={url} alt="" className="w-24 h-24 object-cover rounded-lg border border-green-200 hover:opacity-80 transition" />
              </a>
            ))}
          </div>
        </div>
      )}

      {repair.repliedAt && repair.status !== 'CANCELLED' && repair.status !== 'SHIPPED_BACK' && (
        <div className="mt-6">
          <p className="text-xs text-gray-400 mb-2">
            📦 Une fois votre appareil envoyé, indiquez ici votre numéro de suivi :
          </p>
          <TrackingSubmitForm
            repairId={repair.id}
            initialTrackingNumber={repair.inboundTrackingNumber}
            initialCarrier={repair.inboundCarrier}
          />
        </div>
      )}

      {repair.outboundTrackingNumber && (
        <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-700">
          ✅ Votre appareil réparé est en route en {OUTBOUND_CARRIER_LABELS[repair.outboundCarrier] ?? repair.outboundCarrier},
          suivi : <strong>{repair.outboundTrackingNumber}</strong>
        </div>
      )}

      <p className="text-xs text-gray-400 text-center mt-8">
        Une question ? Appelez-nous au{' '}
        <a href="tel:+33783497262" className="text-brand hover:underline">07 83 49 72 62</a>.
      </p>
    </div>
  );
}
