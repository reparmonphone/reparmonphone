import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import ProfileForm from './ProfileForm';

export default async function ComptePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/compte/connexion');

  return (
    <div className="max-w-xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold mb-1">Mon compte</h1>
      <p className="text-gray-500 mb-8">Gère tes informations personnelles.</p>

      <ProfileForm
        user={{
          email: user.email ?? '',
          firstName: (user.user_metadata?.first_name as string | undefined) ?? '',
          lastName: (user.user_metadata?.last_name as string | undefined) ?? '',
          avatarUrl: (user.user_metadata?.avatar_url as string | undefined) ?? null,
        }}
      />

      <div className="grid grid-cols-2 gap-4 mt-8">
        <Link href="/compte/commandes" className="bg-white border border-gray-100 rounded-xl p-6 hover:shadow-md transition text-center">
          <div className="text-2xl mb-2">🛒</div>
          <p className="font-semibold">Mes commandes</p>
        </Link>
        <Link href="/compte/rdv" className="bg-white border border-gray-100 rounded-xl p-6 hover:shadow-md transition text-center">
          <div className="text-2xl mb-2">📅</div>
          <p className="font-semibold">Mes rendez-vous</p>
        </Link>
      </div>
    </div>
  );
}
