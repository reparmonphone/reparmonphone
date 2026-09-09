import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import MailInRepairStatusSelect from './MailInRepairStatusSelect';
import type { MailInRepairStatus, Prisma } from '@prisma/client';

const STATUS_LABELS: Record<MailInRepairStatus, string> = {
  REQUESTED: 'Demandé',
  AWAITING_DEVICE: "En attente de l'appareil",
  DEVICE_RECEIVED: 'Appareil reçu',
  AWAITING_PAYMENT: 'En attente de paiement',
  PAID: 'Payé',
  SHIPPED_BACK: 'Renvoyé au client',
  CANCELLED: 'Annulé',
};

type SearchParams = { statut?: string; q?: string };

export default async function AdminMailInRepairPage({ searchParams }: { searchParams: SearchParams }) {
  const where: Prisma.MailInRepairWhereInput = {};

  if (searchParams.statut) where.status = searchParams.statut as MailInRepairStatus;
  if (searchParams.q) {
    where.OR = [
      { customerName: { contains: searchParams.q, mode: 'insensitive' } },
      { customerEmail: { contains: searchParams.q, mode: 'insensitive' } },
      { deviceModel: { contains: searchParams.q, mode: 'insensitive' } },
    ];
  }

  const repairs = await prisma.mailInRepair.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200 });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Réparation par correspondance</h1>
      </div>

      <form className="flex flex-wrap gap-2 mb-6 bg-white border border-gray-100 rounded-xl p-4" action="/admin/reparation-a-distance" method="get">
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
        <button type="submit" className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-dark transition">
          Filtrer
        </button>
        {(searchParams.statut || searchParams.q) && (
          <Link href="/admin/reparation-a-distance" className="text-sm text-gray-400 hover:text-brand self-center">
            Réinitialiser
          </Link>
        )}
      </form>

      {repairs.length === 0 ? (
        <p className="text-gray-500">Aucune demande ne correspond à ces filtres.</p>
      ) : (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Appareil</th>
                <th className="px-4 py-3">Reçue le</th>
                <th className="px-4 py-3">Prix</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {repairs.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800">{r.customerName}</div>
                    <div className="text-gray-500 text-xs">{r.customerPhone}</div>
                    <div className="text-gray-500 text-xs">{r.customerEmail}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div>{r.deviceBrand} {r.deviceModel}</div>
                    <div className="text-gray-500 text-xs max-w-xs truncate">{r.issueDescription}</div>
                  </td>
                  <td className="px-4 py-3">{new Date(r.createdAt).toLocaleDateString('fr-FR')}</td>
                  <td className="px-4 py-3">{r.quotedPrice ? `${Number(r.quotedPrice).toFixed(2)}€` : '—'}</td>
                  <td className="px-4 py-3">
                    <MailInRepairStatusSelect repairId={r.id} currentStatus={r.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/reparation-a-distance/${r.id}`} className="text-brand hover:underline whitespace-nowrap">
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
