import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getFinderBrands, getModelPieces } from '@/lib/partFinder';
import PartFinderClient from '@/components/PartFinderClient';
import { formatPrice } from '@/lib/format';
import { addDevice } from './actions';
import RemoveDeviceButton from './RemoveDeviceButton';

export const metadata = { title: 'Mes appareils | ReparMonPhone', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function MesAppareilsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/compte/connexion');

  const devices = await prisma.userDevice.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'asc' } });
  const details = await Promise.all(
    devices.map(async (d) => ({ id: d.id, data: await getModelPieces(d.modelId).catch(() => null) })),
  );
  let brands: Awaited<ReturnType<typeof getFinderBrands>> = [];
  try {
    brands = await getFinderBrands();
  } catch {
    brands = [];
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold mb-1">Mes appareils</h1>
      <p className="text-gray-500 mb-8">
        Enregistrez vos téléphones : vous retrouvez en un clic les pièces en stock qui leur correspondent.
      </p>

      {details.filter((d) => d.data).length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-xl p-8 text-center text-gray-500 mb-8">
          Aucun appareil enregistré pour le moment.
        </div>
      ) : (
        <div className="space-y-4 mb-8">
          {details.map(({ id, data }) =>
            data ? (
              <article key={id} className="bg-white border border-gray-100 rounded-xl p-5">
                <header className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-bold text-gray-900">📱 {data.name}</h2>
                    <p className="text-xs text-gray-500">
                      {data.pieces.length > 0
                        ? 'Pièces en stock pour cet appareil :'
                        : 'Aucune pièce en stock pour le moment.'}
                    </p>
                  </div>
                  <RemoveDeviceButton id={id} name={data.name} />
                </header>
                {data.pieces.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {data.pieces.map((p) => (
                      <Link
                        key={p.slug}
                        href={p.href}
                        className="rounded-full border border-brand bg-brand-light px-3 py-1.5 text-sm font-semibold text-brand-dark hover:bg-brand hover:text-white"
                      >
                        {p.label} · dès {formatPrice(p.minPrice)}
                      </Link>
                    ))}
                  </div>
                )}
                <div className="mt-4 flex flex-wrap gap-4 text-sm">
                  <Link
                    href={`/rdv?${new URLSearchParams({
                      marque: data.brandName,
                      modele: data.name.toLowerCase().startsWith(data.brandName.toLowerCase())
                        ? data.name.slice(data.brandName.length).trim()
                        : data.name,
                    }).toString()}`}
                    className="text-brand hover:underline"
                  >
                    📅 Prendre rendez-vous
                  </Link>
                  <Link href="/devis-reparation" className="text-brand hover:underline">
                    🔧 Devis de réparation
                  </Link>
                </div>
              </article>
            ) : null,
          )}
        </div>
      )}

      {devices.length < 5 && brands.length > 0 && (
        <PartFinderClient brands={brands} mode="device" addDevice={addDevice} />
      )}
    </div>
  );
}
