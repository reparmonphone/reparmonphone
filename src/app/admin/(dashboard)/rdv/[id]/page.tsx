import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import AppointmentStatusSelect from '../AppointmentStatusSelect';
import AppointmentReplyForm from './AppointmentReplyForm';

export default async function AdminRdvDetailPage({ params }: { params: { id: string } }) {
  const appointment = await prisma.appointment.findUnique({ where: { id: params.id } });
  if (!appointment) notFound();

  return (
    <div className="max-w-3xl">
      <Link href="/admin/rdv" className="text-sm text-gray-400 hover:text-brand">← Retour aux rendez-vous</Link>
      <h1 className="text-2xl font-bold mt-2 mb-6">Demande de {appointment.customerName}</h1>

      <div className="bg-white border border-gray-100 rounded-xl p-5 mb-6">
        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-xs text-gray-400">Client</p>
            <p className="font-medium text-gray-800">{appointment.customerName}</p>
            <p className="text-sm text-gray-500">{appointment.customerPhone}</p>
            <p className="text-sm text-gray-500">
              <a href={`mailto:${appointment.customerEmail}`} className="text-brand hover:underline">
                {appointment.customerEmail}
              </a>
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Appareil</p>
            <p className="font-medium text-gray-800">{appointment.deviceBrand} {appointment.deviceModel}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Type de rendez-vous</p>
            <p className="text-gray-700">
              {appointment.type === 'DOMICILE' ? `🏠 Domicile (${appointment.city})` : '🔧 Atelier'}
            </p>
            {Number(appointment.extraFee) > 0 && (
              <p className="text-sm text-orange-600">Frais de déplacement : {Number(appointment.extraFee)}€</p>
            )}
          </div>
          <div>
            <p className="text-xs text-gray-400">Date souhaitée</p>
            <p className="text-gray-700">{new Date(appointment.preferredDate).toLocaleString('fr-FR')}</p>
          </div>
        </div>

        <div className="mb-4">
          <p className="text-xs text-gray-400 mb-1">Description de la panne</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg p-3">
            {appointment.issueDescription}
          </p>
        </div>

        <div>
          <p className="text-xs text-gray-400 mb-1">Statut</p>
          <AppointmentStatusSelect appointmentId={appointment.id} currentStatus={appointment.status} />
        </div>
      </div>

      <AppointmentReplyForm
        appointmentId={appointment.id}
        initialReply={appointment.adminReply}
        initialRepliedAt={appointment.repliedAt}
      />
    </div>
  );
}
