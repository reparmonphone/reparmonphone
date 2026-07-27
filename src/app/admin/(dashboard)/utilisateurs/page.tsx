import Link from 'next/link';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireAdminUser } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';
import DeleteUserButton from './DeleteUserButton';

export const dynamic = 'force-dynamic';

function formatDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

export default async function AdminUtilisateursPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  await requireAdminUser(); // défense en profondeur : cette page expose emails/téléphones/adresses/IP

  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1);
  const perPage = 50;

  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });

  if (error) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-4">Utilisateurs inscrits</h1>
        <p className="text-red-600">Erreur lors du chargement des utilisateurs : {error.message}</p>
      </div>
    );
  }

  const users = data.users;

  // Compte les commandes de chaque utilisateur en une seule requête groupée
  const orderCounts = await prisma.order.groupBy({
    by: ['userId'],
    where: { userId: { in: users.map((u) => u.id) } },
    _count: { id: true },
  });
  const orderCountByUser = new Map(orderCounts.map((o) => [o.userId, o._count.id]));

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold">Utilisateurs inscrits</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{data.total ?? users.length} au total</span>
          <a href="/api/export/clients" className="text-sm bg-gray-800 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 transition">
            ⬇️ Exporter CSV
          </a>
        </div>
      </div>
      <p className="text-gray-500 mb-6 text-sm">
        Comptes clients (hors admin), avec leurs coordonnées renseignées à l&apos;inscription.
      </p>

      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Adresse</th>
              <th className="px-4 py-3">IP inscription</th>
              <th className="px-4 py-3">Commandes</th>
              <th className="px-4 py-3">Inscrit le</th>
              <th className="px-4 py-3">Dernière connexion</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((u) => {
              const meta = u.user_metadata ?? {};
              const isAdmin = u.app_metadata?.role === 'admin';
              const fullName = [meta.first_name, meta.last_name].filter(Boolean).join(' ') || '—';
              return (
                <tr key={u.id} className="hover:bg-gray-50 align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800">{fullName}</div>
                    {isAdmin && (
                      <span className="inline-block mt-1 text-[10px] font-bold bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
                        ADMIN
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div>{u.email}</div>
                    <div className="text-gray-500">{meta.phone || '—'}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-[200px]">
                    {meta.address_line1 ? (
                      <>
                        {meta.address_line1}
                        <br />
                        {meta.address_zip} {meta.address_city}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{meta.signup_ip || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="bg-gray-100 px-2 py-0.5 rounded font-medium">
                      {Number(orderCountByUser.get(u.id) ?? 0)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(u.created_at)}</td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(u.last_sign_in_at)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Link href={`/admin/utilisateurs/${u.id}`} className="text-brand hover:underline mr-3">
                      Modifier
                    </Link>
                    <DeleteUserButton userId={u.id} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {users.length === 0 && <p className="text-gray-500 mt-6">Aucun utilisateur inscrit pour le moment.</p>}

      {data.total && data.total > perPage && (
        <div className="flex items-center justify-center gap-2 mt-6 text-sm">
          {Array.from({ length: Math.ceil(data.total / perPage) }, (_, i) => i + 1).map((p) => (
            <a
              key={p}
              href={`/admin/utilisateurs?page=${p}`}
              className={`w-8 h-8 flex items-center justify-center rounded-lg ${
                p === page ? 'bg-brand text-white' : 'bg-white border border-gray-200 text-gray-600'
              }`}
            >
              {p}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
