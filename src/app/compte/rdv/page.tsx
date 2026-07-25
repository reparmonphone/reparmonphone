import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';

const STATUS_LABELS: Record<string, string> = {
  REQUESTED: 'Demandé',
  CONFIRMED: 'Confirmé',
  DONE: 'Terminé',
  CANCELLED: 'Annulé',
};

export default async function MesRdvPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/compte/connexion');

  const appointments = await prisma.appointment.findMany({
    where: {
      OR: [{ userId: user.id }, { userId: null, customerEmail: user.email }],
    },
    orderBy: { preferredDate: 'desc' },
  });

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold mb-6">Mes rendez-vous</h1>

      {appointments.length === 0 ? (
        <p className="text-gray-500">Tu n&apos;as pas encore de rendez-vous.</p>
      ) : (
        <div className="space-y-3">
          {appointments.map((a) => (
            <div key={a.id} className="bg-white border border-gray-100 rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold">{a.deviceBrand} {a.deviceModel}</span>
                <span className="text-xs bg-gray-100 px-2.5 py-1 rounded-full">{STATUS_LABELS[a.status]}</span>
              </div>
              <p className="text-sm text-gray-500">{new Date(a.preferredDate).toLocaleString('fr-FR')}</p>
              <p className="text-sm text-gray-500">{a.type === 'DOMICILE' ? `🏠 À domicile (${a.city})` : '🔧 En atelier'}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
