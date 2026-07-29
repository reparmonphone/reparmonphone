import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import LogoutButton from './LogoutButton';

type NavItem = { href: string; label: string; exact?: boolean; badgeKey?: 'orders' | 'appointments' | 'messages' };

const NAV: NavItem[] = [
  { href: '/admin', label: '📊 Tableau de bord', exact: true },
  { href: '/admin/produits', label: '📦 Produits & stock' },
  { href: '/admin/gammes', label: '🗂️ Marques, gammes & modèles' },
  { href: '/admin/menu', label: '📋 Menu du header' },
  { href: '/admin/collections', label: '⭐ Collections' },
  { href: '/admin/maintenance', label: '🚧 Mode maintenance' },
  { href: '/admin/commandes', label: '🛒 Commandes', badgeKey: 'orders' },
  { href: '/admin/livraison', label: '🚚 Frais de port' },
  { href: '/admin/paiements', label: '💳 Moyens de paiement' },
  { href: '/admin/codes-promo', label: '🏷️ Codes promo' },
  { href: '/admin/statistiques', label: '📈 Statistiques' },
  { href: '/admin/seo', label: '🔍 SEO & Référencement' },
  { href: '/admin/rdv', label: '📅 Rendez-vous', badgeKey: 'appointments' },
  { href: '/admin/utilisateurs', label: '👥 Utilisateurs' },
  { href: '/admin/messages', label: '✉️ Messages de contact', badgeKey: 'messages' },
  { href: '/admin/pages', label: '📄 Pages de contenu' },
  { href: '/admin/avis', label: '💬 Avis clients' },
  { href: '/admin/partenaires', label: '🤝 Partenaires & liens' },
  { href: '/admin/zones', label: '📍 Zones & tarifs déplacement' },
];

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-auto bg-red-500 text-white text-[11px] font-bold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center shrink-0">
      {count > 99 ? '99+' : count}
    </span>
  );
}

export default async function AdminSidebar() {
  const [pendingOrders, requestedAppointments, unhandledMessages] = await Promise.all([
    prisma.order.count({ where: { status: 'PENDING' } }),
    prisma.appointment.count({ where: { status: 'REQUESTED' } }),
    prisma.contactMessage.count({ where: { handled: false } }),
  ]);

  const badgeCounts: Record<string, number> = {
    orders: pendingOrders,
    appointments: requestedAppointments,
    messages: unhandledMessages,
  };

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
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-gray-800 transition"
          >
            <span>{item.label}</span>
            {item.badgeKey && <Badge count={badgeCounts[item.badgeKey]} />}
          </Link>
        ))}
      </nav>

      <div className="p-3 border-t border-gray-800">
        <LogoutButton />
      </div>
    </aside>
  );
}
