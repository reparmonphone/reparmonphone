import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { User } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

type CookieToSet = { name: string; value: string; options?: CookieOptions };

// Cache en mémoire du statut "mode maintenance" : évite d'appeler /api/maintenance-status (donc
// une invocation de fonction Vercel EN PLUS, sur CHAQUE page vue par CHAQUE visiteur) alors que
// cette valeur ne change que quand Krys bascule le mode maintenance depuis /admin/maintenance.
// Les instances Edge de Vercel réutilisent ce module tant qu'elles restent "chaudes", donc ce
// cache réduit déjà fortement les appels à lui seul, même sans la condition needsAuth ci-dessous.
let maintenanceCache: { enabled: boolean; expiresAt: number } | null = null;
const MAINTENANCE_CACHE_MS = 30_000;

async function isMaintenanceEnabled(request: NextRequest): Promise<boolean> {
  if (maintenanceCache && maintenanceCache.expiresAt > Date.now()) {
    return maintenanceCache.enabled;
  }
  try {
    const statusUrl = new URL('/api/maintenance-status', request.url);
    const statusRes = await fetch(statusUrl);
    const { enabled } = await statusRes.json();
    maintenanceCache = { enabled, expiresAt: Date.now() + MAINTENANCE_CACHE_MS };
    return enabled;
  } catch {
    // Si le check échoue, on laisse passer (comportement identique à avant)
    return false;
  }
}

// Cache en mémoire (borné) des résultats de /api/check-redirect, par chemin. Ces chemins
// "inconnus" sont en grande partie du bruit de bots/scanners qui retapent les mêmes anciennes
// URLs ou sondent les mêmes chemins bidon (wp-login.php, .env...) — inutile de rappeler l'API
// (donc une invocation Vercel) à chaque fois pour la même URL.
const redirectCache = new Map<string, { redirect: { toPath: string; statusCode: number } | null; expiresAt: number }>();
const REDIRECT_CACHE_MS = 5 * 60_000;
const REDIRECT_CACHE_MAX_SIZE = 500;

async function checkCustomRedirect(request: NextRequest, pathname: string) {
  const cached = redirectCache.get(pathname);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.redirect;
  }
  try {
    const checkUrl = new URL('/api/check-redirect', request.url);
    checkUrl.searchParams.set('path', pathname);
    const checkRes = await fetch(checkUrl);
    const { redirect } = await checkRes.json();
    if (redirectCache.size >= REDIRECT_CACHE_MAX_SIZE) {
      const oldestKey = redirectCache.keys().next().value;
      if (oldestKey !== undefined) redirectCache.delete(oldestKey);
    }
    redirectCache.set(pathname, { redirect: redirect ?? null, expiresAt: Date.now() + REDIRECT_CACHE_MS });
    return redirect ?? null;
  } catch {
    // Si le check échoue, on laisse passer (l'utilisateur verra un 404 normal plutôt qu'une erreur bloquante)
    return null;
  }
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const { pathname } = request.nextUrl;

  const isAdminRoute = pathname.startsWith('/admin');
  const isAdminLoginPage = pathname === '/admin/login';

  const isAccountRoute = pathname.startsWith('/compte');
  const isAccountAuthPage = pathname === '/compte/connexion' || pathname === '/compte/inscription';

  const isMaintenancePage = pathname === '/maintenance';

  // Le statut maintenance doit être connu AVANT de décider si on a besoin de vérifier l'auth
  // Supabase (voir needsAuth plus bas) : sur /admin et sur /maintenance elle-même, le bypass est
  // garanti quel que soit le statut, donc pas besoin de le récupérer dans ces deux cas précis
  // (comportement identique à avant).
  const maintenanceEnabled = !isAdminRoute && !isMaintenancePage ? await isMaintenanceEnabled(request) : false;

  // Vérifier la session Supabase (appel réseau vers l'API Auth) coûte cher si on le fait sur
  // CHAQUE page du site. Ce n'est en réalité utile que dans 3 cas : la page est sous /admin ou
  // /compte (pour la gestion d'accès ci-dessous), OU le mode maintenance est actif (pour laisser
  // passer un admin connecté sur le reste du site pendant la maintenance). En dehors de ça — la
  // grande majorité du trafic normal : accueil, boutique, produit, guides... — on saute l'appel
  // entièrement. C'était la principale source de dépassement CPU/invocations Vercel identifiée
  // en septembre 2026 (le mode maintenance étant désactivé la quasi-totalité du temps).
  const needsAuth = isAdminRoute || isAccountRoute || maintenanceEnabled;

  let user: User | null = null;

  if (needsAuth) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet: CookieToSet[]) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            response = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          },
        },
      }
    );

    const {
      data: { user: fetchedUser },
    } = await supabase.auth.getUser();
    user = fetchedUser;
  }

  const isAdminUser = user?.app_metadata?.role === 'admin';

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

  // Redirections 301 "structurelles" issues de la migration WooCommerce → Next.js (voir Google
  // Search Console, rapport Liens, relevé du 2026-09-02 : des centaines d'anciennes URLs encore
  // indexées/liées de l'extérieur, qui renvoyaient un 404 sec). Contrairement aux redirections au
  // cas par cas gérées depuis /admin/seo (une ligne = une URL précise, pour les pages renommées/
  // fusionnées individuellement), celles-ci couvrent des FAMILLES entières d'anciennes URLs par un
  // simple changement de préfixe — pas besoin d'une ligne par produit en base :
  //   - /product/{slug}/...      -> /produit/{slug}   (même slug des deux côtés, vérifié sur
  //     plusieurs exemples réels : seul le préfixe "product" -> "produit" change)
  //   - /product-tag/...         -> /boutique          (anciennes pages de tag WooCommerce, pas
  //     d'équivalent direct dans la nouvelle arborescence marque/gamme/modèle)
  //   - /product-category/...    -> /boutique          (idem, anciennes catégories WooCommerce)
  //   - /mon-compte-2/...        -> /compte             (ancienne page compte/liste d'envies —
  //     ces URLs représentent l'essentiel du volume mais ne sont que des liens d'action
  //     "ajouter à la liste d'envies/comparateur", jamais du contenu à préserver en soi)
  const productMatch = pathname.match(/^\/product\/([^/]+)\/?$/);
  if (productMatch) {
    return NextResponse.redirect(new URL(`/produit/${productMatch[1]}`, request.url), 301);
  }
  if (pathname.startsWith('/product-tag/') || pathname.startsWith('/product-category/')) {
    return NextResponse.redirect(new URL('/boutique', request.url), 301);
  }
  if (pathname === '/mon-compte-2' || pathname.startsWith('/mon-compte-2/')) {
    return NextResponse.redirect(new URL('/compte', request.url), 301);
  }

  // Redirections 301 au cas par cas (utile après une migration de site — anciennes URLs
  // WooCommerce spécifiques, pages renommées/fusionnées individuellement, gérées depuis
  // /admin/seo). On ne vérifie que les chemins qui ne correspondent à AUCUNE route connue de
  // l'app ni à l'une des familles ci-dessus, pour éviter d'appeler la base de données à chaque
  // navigation normale (coût de performance sinon inutile). Le résultat est mis en cache
  // quelques minutes par chemin (voir checkCustomRedirect) car ce sont surtout des bots qui
  // retapent les mêmes URLs mortes en boucle.
  const KNOWN_PREFIXES = [
    '/produit', '/boutique', '/marque', '/collection', '/compte', '/admin', '/rdv', '/contact',
    '/cgv', '/mentions-legales', '/confidentialite', '/a-propos', '/livraison-retours',
    '/panier', '/checkout', '/avis-verifies', '/maintenance', '/_next',
  ];
  const isKnownPath = KNOWN_PREFIXES.some((p) => pathname.startsWith(p)) || pathname === '/';

  if (!isKnownPath) {
    const redirect = await checkCustomRedirect(request, pathname);
    if (redirect) {
      return NextResponse.redirect(new URL(redirect.toPath, request.url), redirect.statusCode);
    }
  }

  // Mode maintenance : bloque tout visiteur non-admin, sauf sur /admin (toujours accessible pour se connecter
  // et gérer le site) et /maintenance elle-même (pour éviter une boucle de redirection).
  if (maintenanceEnabled && !isAdminRoute && !isMaintenancePage && !isAdminUser) {
    return NextResponse.redirect(new URL('/maintenance', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|css|js|txt|xml)$).*)'],
};
