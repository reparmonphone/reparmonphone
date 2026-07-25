import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// À utiliser dans les Server Components, Server Actions et Route Handlers.
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Appelé depuis un Server Component (pas d'écriture possible) — sans conséquence
            // si le middleware rafraîchit déjà la session.
          }
        },
      },
    }
  );
}

// Vérifie qu'un utilisateur ADMIN est connecté, à appeler en tout début de chaque Server Action admin
// (défense en profondeur en plus du middleware). Le rôle est stocké dans app_metadata, que
// seul le service_role Supabase peut modifier — un client ne peut donc jamais se l'auto-attribuer.
export async function requireAdminUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.app_metadata?.role !== 'admin') {
    throw new Error('Non autorisé — accès réservé aux administrateurs');
  }
  return user;
}
