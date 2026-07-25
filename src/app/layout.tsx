import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import Header from '@/components/Header';
import TopUtilityBar from '@/components/TopUtilityBar';
import { prisma } from '@/lib/prisma';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export const metadata: Metadata = {
  title: 'ReparMonPhone | Réparation & Pièces Détachées de Téléphone - Sainte-Maxime',
  description:
    "Réparation de smartphones et vente de pièces détachées à Sainte-Maxime et dans tout le Golfe de Saint-Tropez. Écrans, batteries, connecteurs de charge. Livraison Chronopost 24h.",
};

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
  const [menuTree, user] = await Promise.all([getMenuTree(), getCurrentUser()]);

  return (
    <html lang="fr">
      <body className="bg-white text-gray-900 antialiased">
        <TopUtilityBar />
        <Header menuTree={menuTree} user={user} />
        <main className="min-h-screen">{children}</main>
        <footer className="bg-gray-900 text-gray-300 mt-16 pt-12 pb-6 text-sm">
          <div className="max-w-6xl mx-auto px-4">
            <div className="grid md:grid-cols-3 gap-8 mb-10">
              <div>
                <h3 className="text-white font-semibold mb-3">Informations légales</h3>
                <p className="font-medium text-gray-200">ReparMonPhone</p>
                <p className="mt-1">SIRET : 518 898 549</p>
                <p>Adresse : Les Saquèdes, 83120 Sainte-Maxime</p>
                <p>Hébergeur : OVH — 2 rue Kellermann, 59100 Roubaix</p>
              </div>

              <div>
                <h3 className="text-white font-semibold mb-3">Liens utiles</h3>
                <ul className="space-y-1.5">
                  <li><Link href="/mentions-legales" className="hover:text-white">Mentions légales</Link></li>
                  <li><Link href="/cgv" className="hover:text-white">Conditions Générales de Vente</Link></li>
                  <li><Link href="/livraison-retours" className="hover:text-white">Livraison &amp; Retours</Link></li>
                  <li><Link href="/confidentialite" className="hover:text-white">Politique de confidentialité</Link></li>
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
                  <a href="https://www.facebook.com/ReparMonPhone" target="_blank" rel="noopener noreferrer" className="hover:text-white underline">Facebook</a>
                  {' · '}
                  <a href="https://www.instagram.com" target="_blank" rel="noopener noreferrer" className="hover:text-white underline">Instagram</a>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6 border-t border-gray-800 pt-6 mb-6 text-xs text-gray-400">
              <span className="flex items-center gap-1.5">🔒 SSL Sécurisé</span>
              <span className="flex items-center gap-1.5">💳 Paiement Sécurisé</span>
              <span className="flex items-center gap-1.5">🚚 Livraison 24h Chronopost</span>
              <span className="flex items-center gap-1.5">🇫🇷 SAV en France</span>
            </div>

            <p className="text-xs text-gray-500">
              © {new Date().getFullYear()} ReparMonPhone — Pièces Détachées &amp; Accessoires Téléphone Mobile.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
