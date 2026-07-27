import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAdminUser = user?.app_metadata?.role === 'admin';

  const isAdminRoute = request.nextUrl.pathname.startsWith('/admin');
  const isAdminLoginPage = request.nextUrl.pathname === '/admin/login';

  const isAccountRoute = request.nextUrl.pathname.startsWith('/compte');
  const isAccountAuthPage =
    request.nextUrl.pathname === '/compte/connexion' || request.nextUrl.pathname === '/compte/inscription';

  if (isAdminRoute && !isAdminLoginPage && !isAdminUser) {
    const loginUrl = new URL('/admin/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (isAdminLoginPage && isAdminUser) {
    const adminUrl = new URL('/admin', request.url);
    return NextResponse.redirect(adminUrl);
  }

  if (isAccountRoute && !isAccountAuthPage && !user) {
    const loginUrl = new URL('/compte/connexion', request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (isAccountAuthPage && user) {
    const accountUrl = new URL('/compte', request.url);
    return NextResponse.redirect(accountUrl);
  }

  // Redirections 301 (utile après une migration de site — anciennes URLs WooCommerce, etc.)
  // On ne vérifie que les chemins qui ne correspondent à AUCUNE route connue de l'app, pour éviter
  // d'appeler la base de données à chaque navigation normale (coût de performance sinon inutile).
  const KNOWN_PREFIXES = [
    '/produit', '/boutique', '/marque', '/collection', '/compte', '/admin', '/rdv', '/contact',
    '/cgv', '/mentions-legales', '/confidentialite', '/a-propos', '/livraison-retours',
    '/panier', '/checkout', '/avis-verifies', '/maintenance', '/_next',
  ];
  const isKnownPath = KNOWN_PREFIXES.some((p) => request.nextUrl.pathname.startsWith(p)) || request.nextUrl.pathname === '/';

  if (!isKnownPath) {
    try {
      const checkUrl = new URL('/api/check-redirect', request.url);
      checkUrl.searchParams.set('path', request.nextUrl.pathname);
      const checkRes = await fetch(checkUrl);
      const { redirect } = await checkRes.json();
      if (redirect) {
        return NextResponse.redirect(new URL(redirect.toPath, request.url), redirect.statusCode);
      }
    } catch {
      // Si le check échoue, on laisse passer (l'utilisateur verra un 404 normal plutôt qu'une erreur bloquante)
    }
  }

  // Mode maintenance : bloque tout visiteur non-admin, sauf sur /admin (toujours accessible pour se connecter
  // et gérer le site) et /maintenance elle-même (pour éviter une boucle de redirection).
  const isMaintenancePage = request.nextUrl.pathname === '/maintenance';
  if (!isAdminRoute && !isMaintenancePage && !isAdminUser) {
    try {
      const statusUrl = new URL('/api/maintenance-status', request.url);
      const statusRes = await fetch(statusUrl);
      const { enabled } = await statusRes.json();
      if (enabled) {
        return NextResponse.redirect(new URL('/maintenance', request.url));
      }
    } catch {
      // Si le check échoue (API indisponible...), on laisse passer plutôt que de bloquer le site par erreur.
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|css|js|txt|xml)$).*)'],
};
