import Link from 'next/link';
import LogoutButton from './LogoutButton';

const NAV = [
  { href: '/admin', label: '📊 Tableau de bord', exact: true },
  { href: '/admin/produits', label: '📦 Produits & stock' },
  { href: '/admin/commandes', label: '🛒 Commandes' },
  { href: '/admin/rdv', label: '📅 Rendez-vous' },
  { href: '/admin/messages', label: '✉️ Messages de contact' },
  { href: '/admin/pages', label: '📄 Pages de contenu' },
  { href: '/admin/avis', label: '💬 Avis clients' },
  { href: '/admin/partenaires', label: '🤝 Partenaires & liens' },
  { href: '/admin/zones', label: '📍 Zones & tarifs déplacement' },
];

export default function AdminSidebar() {
  return (
    <aside className="w-64 shrink-0 bg-gray-900 text-gray-200 min-h-screen flex flex-col">
      <div className="p-5 border-b border-gray-800">
        <Link href="/" className="font-bold text-white">
          📲 ReparMonPhone
        </Link>
        <p className="text-xs text-gray-400 mt-0.5">Administration</p>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="block px-3 py-2 rounded-lg text-sm hover:bg-gray-800 transition"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="p-3 border-t border-gray-800">
        <LogoutButton />
      </div>
    </aside>
  );
}
