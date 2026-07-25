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

  return response;
}

export const config = {
  matcher: ['/admin/:path*', '/compte/:path*'],
};
