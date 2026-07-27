import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';
import { formatPrice } from '@/lib/format';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente',
  PAID: 'Payée',
  PROCESSING: 'En préparation',
  SHIPPED: 'Expédiée',
  DELIVERED: 'Livrée',
  CANCELLED: 'Annulée',
  REFUNDED: 'Remboursée',
};

export default async function MesCommandesPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/compte/connexion');

  // On priorise userId (fiable) mais on récupère aussi d'éventuelles anciennes commandes
  // passées avant la création du compte, rattachées seulement par email.
  const orders = await prisma.order.findMany({
    where: {
      OR: [{ userId: user.id }, { userId: null, customerEmail: user.email }],
    },
    orderBy: { createdAt: 'desc' },
    include: { items: true },
  });

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold mb-6">Mes commandes</h1>

      {orders.length === 0 ? (
        <p className="text-gray-500">Tu n&apos;as pas encore de commande.</p>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <Link
              key={o.id}
              href={`/compte/commandes/${o.id}`}
              className="block bg-white border border-gray-100 rounded-xl p-5 hover:shadow-md hover:border-brand transition"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold">Commande #{o.id.slice(-8)}</span>
                <span className="text-xs bg-gray-100 px-2.5 py-1 rounded-full">{STATUS_LABELS[o.status]}</span>
              </div>
              <p className="text-sm text-gray-500 mb-2">{new Date(o.createdAt).toLocaleDateString('fr-FR')} — {o.items.length} article(s)</p>
              <div className="flex items-center justify-between">
                <p className="font-bold">{formatPrice(Number(o.total))}</p>
                <span className="text-brand text-sm font-medium">Voir le détail →</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
