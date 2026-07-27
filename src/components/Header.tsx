'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '@/store/cart';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import { LINE_CONTENT_KEY } from '@/lib/categoryContent';
import SearchBar from './SearchBar';

type Model = { id: string; name: string; slug: string };
type ProductLine = { id: string; name: string; slug: string; models: Model[] };
type Brand = { id: string; name: string; slug: string; lines: ProductLine[] };
type CurrentUser = { email: string; firstName: string; avatarUrl: string | null } | null;
type MenuItem = { id: string; label: string; href: string; openInNewTab: boolean };

const BRAND_ORDER = ['Apple', 'Samsung', 'Huawei', 'Xiaomi'];

function displayName(name: string) {
  return name.trim().toLowerCase().startsWith('autre') ? 'Outils' : name;
}

function sortBrands(brands: Brand[]) {
  return [...brands].sort((a, b) => {
    const ia = BRAND_ORDER.indexOf(a.name);
    const ib = BRAND_ORDER.indexOf(b.name);
    // "Autre" (Outils) et toute marque non listée passent après, dans l'ordre : Apple, Samsung, Huawei, Xiaomi, puis reste
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });
}

export default function Header({
  menuTree,
  menuItems,
  user,
}: {
  menuTree: Brand[];
  menuItems: MenuItem[];
  user: CurrentUser;
}) {
  const router = useRouter();
  const totalItems = useCart((s) => s.totalItems());
  const [openBrand, setOpenBrand] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const brands = sortBrands(menuTree);

  function openBrandMenu(id: string) {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setOpenBrand(id);
  }

  function scheduleCloseBrandMenu() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    // Petit délai avant fermeture : évite que le menu se ferme si la souris quitte brièvement
    // la zone en descendant/traversant en diagonale (mouvement naturel de la souris).
    closeTimer.current = setTimeout(() => setOpenBrand(null), 250);
  }

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    setAccountOpen(false);
    router.push('/');
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg text-brand-dark">
          <Image
            src="https://www.reparmonphone.fr/wp-content/uploads/2025/03/logo-repar-mon-phone-3.png"
            alt="ReparMonPhone"
            width={168}
            height={168}
            quality={100}
            className="rounded shrink-0"
          />
        </Link>

        <nav className="hidden lg:flex items-center gap-1 text-sm font-medium text-gray-700">
          {brands.map((brand) => (
            <div
              key={brand.id}
              className="relative"
              onMouseEnter={() => openBrandMenu(brand.id)}
              onMouseLeave={scheduleCloseBrandMenu}
            >
              <Link
                href={`/marque/${brand.slug}`}
                className="px-3 py-2 rounded-lg hover:bg-brand-light hover:text-brand-dark transition inline-block"
              >
                {displayName(brand.name)}
              </Link>

              {openBrand === brand.id && brand.lines.length > 0 && (
                <div className="absolute z-50 left-0 top-full w-[480px] bg-white border border-gray-100 rounded-xl shadow-lg p-4 grid grid-cols-2 gap-4">
                  {brand.lines.map((line) => {
                    const contentKey = LINE_CONTENT_KEY[`${brand.slug}/${line.slug}`];
                    const lineHref = contentKey
                      ? `/marque/${brand.slug}/${contentKey}`
                      : `/boutique?marque=${brand.slug}&gamme=${line.slug}`;
                    return (
                      <div key={line.id}>
                        <Link href={lineHref} className="text-sm font-bold text-brand-dark hover:underline">
                          {displayName(brand.name)} / {displayName(line.name)}
                        </Link>
                        <ul className="mt-1 space-y-0.5">
                          {line.models.slice(0, 6).map((model) => (
                            <li key={model.id}>
                              <Link
                                href={`/boutique?marque=${brand.slug}&gamme=${line.slug}&modele=${model.slug}`}
                                className="text-xs text-gray-500 hover:text-brand"
                              >
                                {model.name}
                              </Link>
                            </li>
                          ))}
                          {line.models.length > 6 && (
                            <li>
                              <Link href={lineHref} className="text-xs text-brand font-medium">
                                Voir tous les modèles ({line.models.length}) →
                              </Link>
                            </li>
                          )}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
          {menuItems.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              target={item.openInNewTab ? '_blank' : undefined}
              rel={item.openInNewTab ? 'noopener noreferrer' : undefined}
              className="px-3 py-2 rounded-lg hover:bg-brand-light hover:text-brand-dark transition"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {/* Menu compte */}
          <div className="relative" onMouseEnter={() => setAccountOpen(true)} onMouseLeave={() => setAccountOpen(false)}>
            {user ? (
              <button className="flex items-center gap-2 text-sm font-medium text-gray-700 px-3 py-2 rounded-lg hover:bg-brand-light hover:text-brand-dark transition">
                {user.avatarUrl ? (
                  <Image src={user.avatarUrl} alt="" width={24} height={24} className="rounded-full object-cover" />
                ) : (
                  <span>👤</span>
                )}
                <span className="hidden sm:inline max-w-[120px] truncate">{user.firstName || user.email}</span>
              </button>
            ) : (
              <Link
                href="/compte/connexion"
                className="hidden sm:flex items-center gap-2 text-sm font-semibold text-brand border border-brand px-4 py-2 rounded-lg hover:bg-brand-light transition"
              >
                Connexion / Inscription
              </Link>
            )}

            {accountOpen && (
              <div className="absolute right-0 top-full w-56 bg-white border border-gray-100 rounded-xl shadow-lg py-2">
                {user ? (
                  <>
                    <Link href="/compte" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                      Mon profil
                    </Link>
                    <Link href="/compte/commandes" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                      Mes commandes
                    </Link>
                    <Link href="/compte/rdv" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                      Mes rendez-vous
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 border-t border-gray-100 mt-1"
                    >
                      Se déconnecter
                    </button>
                  </>
                ) : (
                  <>
                    <Link href="/compte/connexion" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                      Connexion
                    </Link>
                    <Link href="/compte/inscription" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                      Créer un compte
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>

          <Link
            href="/panier"
            className="relative flex items-center gap-2 rounded-full bg-brand text-white px-4 py-2 text-sm font-semibold hover:bg-brand-dark transition"
          >
            🛒 Panier
            {totalItems > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {totalItems}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* Barre de recherche */}
      <div className="border-t border-gray-100 bg-gray-50/50">
        <div className="max-w-6xl mx-auto px-4 py-2.5">
          <SearchBar className="max-w-xl mx-auto lg:mx-0" />
        </div>
      </div>

      {/* Menu mobile simplifié */}
      <div className="lg:hidden border-t border-gray-100 px-4 py-2 flex gap-3 overflow-x-auto text-sm">
        {brands.map((brand) => (
          <Link key={brand.id} href={`/marque/${brand.slug}`} className="shrink-0 text-gray-600">
            {displayName(brand.name)}
          </Link>
        ))}
        {menuItems.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            target={item.openInNewTab ? '_blank' : undefined}
            rel={item.openInNewTab ? 'noopener noreferrer' : undefined}
            className="shrink-0 text-brand font-medium"
          >
            {item.label}
          </Link>
        ))}
        {!user && (
          <Link href="/compte/connexion" className="shrink-0 text-brand font-medium">Connexion</Link>
        )}
      </div>
    </header>
  );
}
