import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';

const STATUS_LABELS: Record<string, string> = {
  REQUESTED: 'Demande reçue',
  AWAITING_DEVICE: 'En attente de votre envoi',
  DEVICE_RECEIVED: 'Diagnostic en cours',
  AWAITING_PAYMENT: 'En attente de paiement',
  PAID: 'Préparation du renvoi',
  SHIPPED_BACK: 'Renvoyée',
  CANCELLED: 'Annulée',
};

export default async function MesReparationsADistancePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/compte/connexion?redirect=/compte/reparation-a-distance');

  // Même logique que /compte/commandes et /compte/rdv : on rattache par userId quand la demande a
  // été faite en étant connecté, sinon par email (cas d'une demande faite sans compte).
  const repairs = await prisma.mailInRepair.findMany({
    where: {
      OR: [{ userId: user.id }, { userId: null, customerEmail: user.email }],
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold mb-6">Mes réparations par correspondance</h1>

      {repairs.length === 0 ? (
        <p className="text-gray-500">Tu n&apos;as pas encore de demande de réparation par correspondance.</p>
      ) : (
        <div className="space-y-3">
          {repairs.map((r) => (
            <Link
              key={r.id}
              href={`/compte/reparation-a-distance/${r.id}`}
              className="block bg-white border border-gray-100 rounded-xl p-5 hover:shadow-md hover:border-brand transition"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold">{r.deviceBrand} {r.deviceModel}</span>
                <span className="text-xs bg-gray-100 px-2.5 py-1 rounded-full">{STATUS_LABELS[r.status]}</span>
              </div>
              <p className="text-sm text-gray-500 mb-2">{new Date(r.createdAt).toLocaleDateString('fr-FR')}</p>
              <span className="text-brand text-sm font-medium">Voir le suivi →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
