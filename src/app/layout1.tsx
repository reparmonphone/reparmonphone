import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import Header from '@/components/Header';
import TopUtilityBar from '@/components/TopUtilityBar';
import VerifiedReviewsFloatingBadge from '@/components/VerifiedReviewsFloatingBadge';
import HelpWidget from '@/components/HelpWidget';
import TrackVisit from '@/components/TrackVisit';
import CookieConsentBanner from '@/components/CookieConsentBanner';
import ManageCookiesLink from '@/components/ManageCookiesLink';
import SmartlookLoader from '@/components/SmartlookLoader';
import JsonLd from '@/components/JsonLd';
import { prisma } from '@/lib/prisma';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getSiteMeta } from '@/lib/siteMeta';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.reparmonphone.fr';

export async function generateMetadata(): Promise<Metadata> {
  const { title: SITE_TITLE, description: SITE_DESCRIPTION } = await getSiteMeta();

  let googleVerification: string | undefined;
  let bingVerification: string | undefined;
  try {
    const settings = await prisma.siteSetting.findMany({
      where: { key: { in: ['seo_google_verification', 'seo_bing_verification'] } },
    });
    googleVerification = settings.find((s) => s.key === 'seo_google_verification')?.value || undefined;
    bingVerification = settings.find((s) => s.key === 'seo_bing_verification')?.value || undefined;
  } catch {
    // base pas encore initialisée — pas bloquant
  }

  return {
    metadataBase: new URL(SITE_URL),
    title: { default: SITE_TITLE, template: '%s | ReparMonPhone' },
    description: SITE_DESCRIPTION,
    openGraph: {
      type: 'website',
      locale: 'fr_FR',
      siteName: 'ReparMonPhone',
      title: SITE_TITLE,
      description: SITE_DESCRIPTION,
      url: SITE_URL,
    },
    twitter: {
      card: 'summary_large_image',
      title: SITE_TITLE,
      description: SITE_DESCRIPTION,
    },
    verification: {
      google: googleVerification,
      other: bingVerification ? { 'msvalidate.01': bingVerification } : undefined,
    },
  };
}

async function getMenuTree() {
  try {
    return await prisma.brand.findMany({
      orderBy: { name: 'asc' },
      include: {
        lines: {
          orderBy: { name: 'asc' },
          include: { models: { orderBy: { name: 'asc' } } },
        },
      },
    });
  } catch (e) {
    console.error('Impossible de charger le menu (base de données non initialisée ?)', e);
    return [];
  }
}

async function getMenuItems() {
  try {
    return await prisma.headerMenuItem.findMany({ orderBy: { order: 'asc' } });
  } catch (e) {
    console.error('Impossible de charger le menu personnalisé', e);
    return [];
  }
}

async function getCurrentUser() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    return {
      email: user.email ?? '',
      firstName: (user.user_metadata?.first_name as string | undefined) ?? '',
      avatarUrl: (user.user_metadata?.avatar_url as string | undefined) ?? null,
    };
  } catch (e) {
    console.error('Impossible de récupérer la session', e);
    return null;
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [menuTree, menuItems, user] = await Promise.all([getMenuTree(), getMenuItems(), getCurrentUser()]);

  const localBusinessSchema = {
    '@context': 'https://schema.org',
    '@type': 'ElectronicsStore',
    name: 'ReparMonPhone',
    image: `${SITE_URL}/icon.png`,
    '@id': SITE_URL,
    url: SITE_URL,
    telephone: '+33783497262',
    priceRange: '€€',
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Les Saquèdes',
      addressLocality: 'Sainte-Maxime',
      postalCode: '83120',
      addressCountry: 'FR',
    },
    areaServed: ['Sainte-Maxime', 'Golfe de Saint-Tropez', 'Var', 'France'],
    sameAs: [
      'https://www.facebook.com/830284890366434',
      'https://www.instagram.com/repar_mon_phone/',
    ],
  };

  return (
    <html lang="fr">
      <body className="bg-white text-gray-900 antialiased">
        <JsonLd data={localBusinessSchema} />
        <TopUtilityBar />
        <Header menuTree={menuTree} menuItems={menuItems} user={user} />
        <main className="min-h-screen">{children}</main>
        <footer className="bg-gray-900 text-gray-300 mt-16 pt-12 pb-6 text-sm">
          <div className="max-w-6xl mx-auto px-4">
            <div className="grid md:grid-cols-3 gap-8 mb-10">
              <div>
                <h3 className="text-white font-semibold mb-3">Informations légales</h3>
                <p className="font-medium text-gray-200">ReparMonPhone</p>
                <p className="mt-1">SIREN : 518 898 549</p>
                <p>Adresse : Les Saquèdes, 83120 Sainte-Maxime</p>
                <p>Hébergeur : Vercel Inc. 340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis</p>
              </div>

              <div>
                <h3 className="text-white font-semibold mb-3">Liens utiles</h3>
                <ul className="space-y-1.5">
                  <li><Link href="/mentions-legales" className="hover:text-white">Mentions légales</Link></li>
                  <li><Link href="/cgv" className="hover:text-white">Conditions Générales de Vente</Link></li>
                  <li><Link href="/livraison-retours" className="hover:text-white">Livraison &amp; Retours</Link></li>
                  <li><Link href="/confidentialite" className="hover:text-white">Politique de confidentialité</Link></li>
                  <li><ManageCookiesLink /></li>
                  <li><Link href="/a-propos" className="hover:text-white">À propos de nous</Link></li>
                  <li><Link href="/contact" className="hover:text-white">Contact</Link></li>
                  <li><Link href="/rdv" className="hover:text-white">Prendre RDV</Link></li>
                </ul>
              </div>

              <div>
                <h3 className="text-white font-semibold mb-3">Nous contacter</h3>
                <p>Email : <a href="mailto:contact@reparmonphone.fr" className="hover:text-white">contact@reparmonphone.fr</a></p>
                <p>Tél : <a href="tel:+33783497262" className="hover:text-white">07 83 49 72 62</a></p>
                <p>Service client : Lun–Sam 9h–18h</p>
                <p className="mt-3">
                  Suivez-nous :{' '}
                  <a href="https://www.facebook.com/830284890366434" target="_blank" rel="noopener noreferrer" className="hover:text-white underline">Facebook</a>
                  {' · '}
                  <a href="https://www.instagram.com/repar_mon_phone/" target="_blank" rel="noopener noreferrer" className="hover:text-white underline">Instagram</a>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6 border-t border-gray-800 pt-6 mb-6 text-xs text-gray-400">
              <span className="flex items-center gap-1.5">🔒 SSL Sécurisé</span>
              <span className="flex items-center gap-1.5">💳 Paiement Sécurisé</span>
              <span className="flex items-center gap-1.5">🚚 Livraison 24h Chronopost</span>
              <span className="flex items-center gap-1.5">🇫🇷 SAV en France</span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <a
                href="/avis-verifies"
                suppressHydrationWarning
                className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 transition rounded-lg px-3 py-2 text-xs"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L4 5v6c0 5.5 3.4 10.2 8 11.5 4.6-1.3 8-6 8-11.5V5l-8-3z" fill="#22c55e" />
                  <path d="M9 12.5l2 2 4-4.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>
                  <span className="text-white font-semibold">Avis Vérifiés</span>
                  <span className="text-gray-400"> — en savoir plus</span>
                </span>
              </a>

              <p className="text-xs text-gray-500">
                © {new Date().getFullYear()} ReparMonPhone — Pièces Détachées &amp; Accessoires Téléphone Mobile.
              </p>
            </div>
          </div>
        </footer>
        <VerifiedReviewsFloatingBadge />
        <HelpWidget />
        <TrackVisit />
        <CookieConsentBanner />
        <SmartlookLoader />
      </body>
    </html>
  );
}
