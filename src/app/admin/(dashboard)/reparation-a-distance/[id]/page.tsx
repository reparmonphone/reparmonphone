import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import MailInRepairStatusSelect from '../MailInRepairStatusSelect';
import MailInRepairReplyForm from './MailInRepairReplyForm';
import MailInRepairPaymentForm from './MailInRepairPaymentForm';
import MailInRepairLogisticsForm from './MailInRepairLogisticsForm';
import MailInRepairPhotosForm from './MailInRepairPhotosForm';

export default async function AdminMailInRepairDetailPage({ params }: { params: { id: string } }) {
  const repair = await prisma.mailInRepair.findUnique({
    where: { id: params.id },
    include: { replies: { orderBy: { createdAt: 'asc' } } },
  });
  if (!repair) notFound();

  const latestQuoteReply = [...repair.replies].reverse().find((r) => r.quotedEstimate != null);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/admin/reparation-a-distance" className="text-sm text-gray-400 hover:text-brand">← Retour aux demandes</Link>
        <h1 className="text-2xl font-bold mt-2">Demande de {repair.customerName}</h1>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl p-5">
        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-xs text-gray-400">Client</p>
            <p className="font-medium text-gray-800">{repair.customerName}</p>
            <p className="text-sm text-gray-500">{repair.customerPhone}</p>
            <p className="text-sm text-gray-500">
              <a href={`mailto:${repair.customerEmail}`} className="text-brand hover:underline">
                {repair.customerEmail}
              </a>
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Appareil</p>
            <p className="font-medium text-gray-800">{repair.deviceBrand} {repair.deviceModel}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Reçue le</p>
            <p className="text-gray-700">{new Date(repair.createdAt).toLocaleString('fr-FR')}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Prix annoncé</p>
            <p className="text-gray-700">{repair.quotedPrice ? `${Number(repair.quotedPrice).toFixed(2)}€ (renvoi Chronopost inclus)` : '—'}</p>
          </div>
        </div>

        <div className="mb-4">
          <p className="text-xs text-gray-400 mb-1">Description de la panne</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg p-3">
            {repair.issueDescription}
          </p>
        </div>

        {repair.clientPhotos.length > 0 && (
          <div className="mb-4">
            <p className="text-xs text-gray-400 mb-1">Photos jointes par le client</p>
            <div className="flex flex-wrap gap-2">
              {repair.clientPhotos.map((url) => (
                <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                  <img src={url} alt="" className="w-20 h-20 object-cover rounded-lg border border-gray-200 hover:opacity-80 transition" />
                </a>
              ))}
            </div>
          </div>
        )}

        <div className="mb-4">
          <p className="text-xs text-gray-400 mb-1">Statut</p>
          <MailInRepairStatusSelect repairId={repair.id} currentStatus={repair.status} />
        </div>

        {latestQuoteReply && (
          <div className="mb-4">
            <p className="text-xs text-gray-400 mb-1">Devis</p>
            <p className="text-sm text-gray-700">
              {Number(latestQuoteReply.quotedEstimate).toFixed(2)} €{' — '}
              {repair.quoteDecision === 'ACCEPTED' && (
                <span className="text-green-700 font-semibold">✓ Accepté par le client</span>
              )}
              {repair.quoteDecision === 'DECLINED' && (
                <span className="text-red-600 font-semibold">✗ Refusé par le client</span>
              )}
              {!repair.quoteDecision && (
                <span className="text-amber-600 font-semibold">En attente de la décision du client</span>
              )}
            </p>
          </div>
        )}

        <div>
          <p className="text-xs text-gray-400 mb-1">
            Lien de suivi client (envoyé automatiquement dans l'email de réponse ci-dessous — utile à
            renvoyer manuellement si besoin)
          </p>
          <p className="text-sm text-brand break-all bg-gray-50 rounded-lg px-3 py-2">
            {`${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.reparmonphone.fr'}/reparation-a-distance/suivi/${repair.id}`}
          </p>
        </div>
      </div>

      <MailInRepairReplyForm
        repairId={repair.id}
        replies={repair.replies.map((reply) => ({
          id: reply.id,
          message: reply.message,
          quotedEstimate: reply.quotedEstimate != null ? Number(reply.quotedEstimate) : null,
          createdAt: reply.createdAt,
        }))}
      />

      <MailInRepairPaymentForm
        repairId={repair.id}
        quotedPrice={repair.quotedPrice ? Number(repair.quotedPrice) : null}
      />

      <MailInRepairLogisticsForm
        repairId={repair.id}
        initialInboundTracking={repair.inboundTrackingNumber}
        initialInboundCarrier={repair.inboundCarrier}
        initialOutboundTracking={repair.outboundTrackingNumber}
        initialOutboundCarrier={repair.outboundCarrier}
        initialAdminNote={repair.adminNote}
      />

      <MailInRepairPhotosForm repairId={repair.id} initialPhotos={repair.repairedPhotos} />
    </div>
  );
}
