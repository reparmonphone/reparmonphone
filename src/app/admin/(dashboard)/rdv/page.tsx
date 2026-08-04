import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import AppointmentStatusSelect from './AppointmentStatusSelect';
import type { AppointmentStatus, AppointmentType, Prisma } from '@prisma/client';

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  REQUESTED: 'Demandé',
  CONFIRMED: 'Confirmé',
  DONE: 'Terminé',
  CANCELLED: 'Annulé',
};

type RdvSearchParams = {
  statut?: string;
  type?: string;
  ville?: string;
  du?: string;
  au?: string;
  q?: string;
};

export default async function AdminRdvPage({ searchParams }: { searchParams: RdvSearchParams }) {
  const where: Prisma.AppointmentWhereInput = {};

  if (searchParams.statut) where.status = searchParams.statut as AppointmentStatus;
  if (searchParams.type) where.type = searchParams.type as AppointmentType;
  if (searchParams.ville) where.city = searchParams.ville;
  if (searchParams.du || searchParams.au) {
    where.preferredDate = {
      ...(searchParams.du ? { gte: new Date(searchParams.du) } : {}),
      ...(searchParams.au ? { lte: new Date(`${searchParams.au}T23:59:59`) } : {}),
    };
  }
  if (searchParams.q) {
    where.OR = [
      { customerName: { contains: searchParams.q, mode: 'insensitive' } },
      { customerEmail: { contains: searchParams.q, mode: 'insensitive' } },
      { deviceModel: { contains: searchParams.q, mode: 'insensitive' } },
    ];
  }

  const [appointments, cities] = await Promise.all([
    prisma.appointment.findMany({ where, orderBy: { preferredDate: 'asc' }, take: 200 }),
    prisma.appointment.findMany({ distinct: ['city'], select: { city: true }, orderBy: { city: 'asc' } }),
  ]);

  // Reconstruit la query string actuelle pour la passer telle quelle au lien d'export CSV
  const exportParams = new URLSearchParams();
  Object.entries(searchParams).forEach(([key, value]) => {
    if (value) exportParams.set(key, value);
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Rendez-vous</h1>
        <a
          href={`/api/export/rdv?${exportParams.toString()}`}
          className="text-sm bg-gray-800 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 transition"
        >
          ⬇️ Exporter CSV
        </a>
      </div>

      <form className="flex flex-wrap gap-2 mb-6 bg-white border border-gray-100 rounded-xl p-4" action="/admin/rdv" method="get">
        <input
          type="text"
          name="q"
          defaultValue={searchParams.q}
          placeholder="Nom, email, modèle..."
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1 min-w-[180px]"
        />
        <select name="statut" defaultValue={searchParams.statut ?? ''} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
          <option value="">Tous les statuts</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select name="type" defaultValue={searchParams.type ?? ''} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
          <option value="">Atelier + Domicile</option>
          <option value="ATELIER">🔧 Atelier</option>
          <option value="DOMICILE">🏠 Domicile</option>
        </select>
        <select name="ville" defaultValue={searchParams.ville ?? ''} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
          <option value="">Toutes les villes</option>
          {cities.map((c) => (
            <option key={c.city} value={c.city}>{c.city}</option>
          ))}
        </select>
        <input type="date" name="du" defaultValue={searchParams.du} className="border border-gray-200 rounded-lg px-3 py-2 text-sm" title="Du" />
        <input type="date" name="au" defaultValue={searchParams.au} className="border border-gray-200 rounded-lg px-3 py-2 text-sm" title="Au" />
        <button type="submit" className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-dark transition">
          Filtrer
        </button>
        {(searchParams.statut || searchParams.type || searchParams.ville || searchParams.du || searchParams.au || searchParams.q) && (
          <Link href="/admin/rdv" className="text-sm text-gray-400 hover:text-brand self-center">
            Réinitialiser
          </Link>
        )}
      </form>

      {appointments.length === 0 ? (
        <p className="text-gray-500">Aucun rendez-vous ne correspond à ces filtres.</p>
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
                <th className="px-4 py-3"></th>
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
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/rdv/${a.id}`} className="text-brand hover:underline whitespace-nowrap">
                      Voir / Répondre
                    </Link>
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
