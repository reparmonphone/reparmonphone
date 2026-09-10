import AdminSidebar from '@/components/admin/AdminSidebar';

export const metadata = { title: 'Administration | ReparMonPhone' };

// Force TOUTES les pages admin à se recalculer à chaque requête, jamais en statique. L'authentification
// admin est vérifiée dans middleware.ts (avant même d'atteindre la page), donc les pages admin
// elles-mêmes n'appellent aucune API dynamique (cookies(), etc.) — sans cette ligne, Next.js les
// traite comme statiques et les fige au moment du build (chiffres du dashboard, statistiques, badges
// de notification... plus jamais à jour après un déploiement). Le trafic admin est minime, donc pas de
// risque de reproduire la surconsommation CPU corrigée sur les pages publiques (produit/boutique).
export const dynamic = 'force-dynamic';

// Menu admin utilisable sur mobile/tablette : une case à cocher cachée (#admin-nav-toggle) pilote
// l'ouverture du tiroir latéral en pur CSS (classes peer-checked: sur AdminSidebar et l'overlay
// ci-dessous), sans JavaScript — pas besoin de rendre ce layout ou AdminSidebar "use client". La
// case doit précéder tout élément qui réagit à peer-checked dans le DOM (règle CSS "sibling").
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <input type="checkbox" id="admin-nav-toggle" className="peer hidden" />

      <AdminSidebar />

      {/* Overlay mobile : cliquer en dehors du tiroir le referme (décoche la case) */}
      <label
        htmlFor="admin-nav-toggle"
        className="hidden peer-checked:block lg:hidden fixed inset-0 bg-black/40 z-30"
        aria-hidden="true"
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="lg:hidden sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
          <label
            htmlFor="admin-nav-toggle"
            className="text-2xl leading-none cursor-pointer px-1"
            aria-label="Ouvrir le menu"
          >
            ☰
          </label>
          <span className="font-semibold text-gray-800">Administration</span>
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-x-auto">{children}</main>
      </div>
    </div>
  );
}
