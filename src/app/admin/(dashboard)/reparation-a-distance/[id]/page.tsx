import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import MailInRepairStatusSelect from '../MailInRepairStatusSelect';
import MailInRepairReplyForm from './MailInRepairReplyForm';
import MailInRepairPaymentForm from './MailInRepairPaymentForm';
import MailInRepairLogisticsForm from './MailInRepairLogisticsForm';

export default async function AdminMailInRepairDetailPage({ params }: { params: { id: string } }) {
  const repair = await prisma.mailInRepair.findUnique({ where: { id: params.id } });
  if (!repair) notFound();

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

        <div>
          <p className="text-xs text-gray-400 mb-1">Statut</p>
          <MailInRepairStatusSelect repairId={repair.id} currentStatus={repair.status} />
        </div>
      </div>

      <MailInRepairReplyForm
        repairId={repair.id}
        initialReply={repair.adminReply}
        initialRepliedAt={repair.repliedAt}
      />

      <MailInRepairPaymentForm
        repairId={repair.id}
        quotedPrice={repair.quotedPrice ? Number(repair.quotedPrice) : null}
      />

      <MailInRepairLogisticsForm
        repairId={repair.id}
        initialInboundTracking={repair.inboundTrackingNumber}
        initialOutboundTracking={repair.outboundTrackingNumber}
        initialOutboundCarrier={repair.outboundCarrier}
        initialAdminNote={repair.adminNote}
      />
    </div>
  );
}
