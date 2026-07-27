import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireAdminUser } from '@/lib/supabase-server';
import UserEditForm from './UserEditForm';

export default async function AdminUserEditPage({ params }: { params: { id: string } }) {
  await requireAdminUser();

  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(params.id);

  if (error || !data.user) notFound();

  const u = data.user;
  const meta = u.user_metadata ?? {};

  return (
    <div className="max-w-xl">
      <Link href="/admin/utilisateurs" className="text-sm text-gray-500 hover:text-gray-800">← Retour aux utilisateurs</Link>
      <h1 className="text-2xl font-bold mt-2 mb-1">{meta.first_name ? `${meta.first_name} ${meta.last_name ?? ''}` : u.email}</h1>
      <p className="text-gray-500 mb-6">{u.email}</p>

      <UserEditForm
        userId={u.id}
        user={{
          firstName: meta.first_name ?? '',
          lastName: meta.last_name ?? '',
          phone: meta.phone ?? '',
          addressLine1: meta.address_line1 ?? '',
          addressCity: meta.address_city ?? '',
          addressZip: meta.address_zip ?? '',
          isAdmin: u.app_metadata?.role === 'admin',
        }}
      />
    </div>
  );
}
