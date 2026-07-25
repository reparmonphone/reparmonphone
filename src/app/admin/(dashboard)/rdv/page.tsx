import { prisma } from '@/lib/prisma';
import AppointmentStatusSelect from './AppointmentStatusSelect';

export default async function AdminRdvPage() {
  const appointments = await prisma.appointment.findMany({
    orderBy: { preferredDate: 'asc' },
    take: 100,
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Rendez-vous</h1>

      {appointments.length === 0 ? (
        <p className="text-gray-500">Aucune demande de RDV pour le moment.</p>
      ) : (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Appareil</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Date souhaitée</th>
                <th className="px-4 py-3">Frais dépl.</th>
                <th className="px-4 py-3">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {appointments.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50 align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800">{a.customerName}</div>
                    <div className="text-gray-500 text-xs">{a.customerPhone}</div>
                    <div className="text-gray-500 text-xs">{a.customerEmail}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div>{a.deviceBrand} {a.deviceModel}</div>
                    <div className="text-gray-500 text-xs max-w-xs truncate">{a.issueDescription}</div>
                  </td>
                  <td className="px-4 py-3">
                    {a.type === 'DOMICILE' ? `🏠 Domicile (${a.city})` : '🔧 Atelier'}
                  </td>
                  <td className="px-4 py-3">{new Date(a.preferredDate).toLocaleString('fr-FR')}</td>
                  <td className="px-4 py-3">{Number(a.extraFee) > 0 ? `${a.extraFee}€` : '—'}</td>
                  <td className="px-4 py-3">
                    <AppointmentStatusSelect appointmentId={a.id} currentStatus={a.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
