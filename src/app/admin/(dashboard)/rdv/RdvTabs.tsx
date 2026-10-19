import Link from 'next/link';

// Onglets de la section Rendez-vous : demandes reçues / disponibilités (créneaux ouverts ou fermés).
export default function RdvTabs({ active }: { active: 'demandes' | 'disponibilites' | 'agenda' }) {
  const base = 'px-4 py-2 text-sm font-medium rounded-lg transition';
  const on = 'bg-brand text-white';
  const off = 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50';
  return (
    <div className="flex flex-wrap gap-2 mb-6">
      <Link href="/admin/rdv" className={`${base} ${active === 'demandes' ? on : off}`}>
        📅 Demandes de RDV
      </Link>
      <Link href="/admin/rdv/disponibilites" className={`${base} ${active === 'disponibilites' ? on : off}`}>
        🗓️ Mes disponibilités
      </Link>
      <Link href="/admin/rdv/agenda" className={`${base} ${active === 'agenda' ? on : off}`}>
        📆 Google Agenda
      </Link>
    </div>
  );
}
