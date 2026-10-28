import Link from 'next/link';
import { requireAdminUser } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';
import { getRelanceData } from './actions';
import RelanceManager from './RelanceManager';

export const dynamic = 'force-dynamic';

export default async function AdminRelanceInscritsPage() {
  await requireAdminUser();
  const [data, promos] = await Promise.all([
    getRelanceData(),
    prisma.promoCode.findMany({ where: { active: true }, orderBy: { createdAt: 'desc' }, select: { code: true, type: true, value: true } }),
  ]);

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-1">📣 Relance des inscrits sans commande</h1>
      <p className="text-gray-500 mb-6 text-sm">
        Envoie un e-mail professionnel aux personnes qui ont créé un compte mais n&apos;ont jamais commandé, pour les inciter à passer leur première commande.
        Seuls les inscrits qui ont <strong>accepté de recevoir les offres</strong> (case à cocher à l&apos;inscription ou dans « Mon compte », ou inscription à la newsletter) sont contactés.
        Chaque e-mail contient un lien de désinscription, et une même personne n&apos;est jamais relancée deux fois en moins de 60 jours.
      </p>
      {'error' in data ? (
        <p className="text-red-600">Erreur : {data.error}</p>
      ) : (
        <RelanceManager
          stats={data.stats}
          rows={data.rows}
          promos={promos.map((p: { code: string; type: string; value: unknown }) => ({
            code: p.code,
            label: p.type === 'PERCENT' ? `${Number(p.value)} %` : `${Number(p.value)} €`,
          }))}
        />
      )}
      <p className="text-xs text-gray-400 mt-6">
        Pour créer le code de bienvenue : <Link href="/admin/codes-promo" className="text-brand hover:underline">Codes promo</Link> → par exemple BIENVENUE5, 5 %, « une seule fois par client » coché.
      </p>
    </div>
  );
}
