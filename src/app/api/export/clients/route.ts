import { requireAdminUser } from '@/lib/supabase-server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { prisma } from '@/lib/prisma';
import { toCsv, csvResponse } from '@/lib/csv';

export async function GET() {
  await requireAdminUser();

  const supabaseAdmin = createSupabaseAdminClient();

  // Récupère tous les utilisateurs en parcourant les pages (l'API Supabase Auth est paginée)
  const allUsers = [];
  let page = 1;
  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data.users.length) break;
    allUsers.push(...data.users);
    if (data.users.length < 1000) break;
    page++;
  }

  const orderCounts = await prisma.order.groupBy({
    by: ['userId'],
    where: { userId: { in: allUsers.map((u) => u.id) } },
    _count: { id: true },
  });
  const orderCountByUser = new Map(orderCounts.map((o) => [o.userId, o._count.id]));

  const rows = allUsers.map((u) => {
    const meta = u.user_metadata ?? {};
    return [
      [meta.first_name, meta.last_name].filter(Boolean).join(' '),
      u.email,
      meta.phone ?? '',
      meta.address_line1 ?? '',
      meta.address_zip ?? '',
      meta.address_city ?? '',
      orderCountByUser.get(u.id) ?? 0,
      u.app_metadata?.role === 'admin' ? 'Oui' : 'Non',
      u.created_at ? new Date(u.created_at).toLocaleDateString('fr-FR') : '',
      u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString('fr-FR') : '',
    ];
  });

  const csv = toCsv(
    ['Nom', 'Email', 'Téléphone', 'Adresse', 'Code postal', 'Ville', 'Nb commandes', 'Admin', 'Inscrit le', 'Dernière connexion'],
    rows
  );

  return csvResponse(csv, `clients-reparmonphone-${new Date().toISOString().slice(0, 10)}.csv`);
}
