import { readPromoStats } from '@/lib/promoStats';
import { statsIdFor } from '@/lib/promoPopup';
import ResetStatsButton from './ResetStatsButton';

const fmt = new Intl.NumberFormat('fr-FR');
const dayFr = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

// Compteurs de l'offre réglée ci-dessous : combien de fois le pop-up s'est affiché, combien de visiteurs ont cliqué.
export default async function PopupStats({ ctaHref, title }: { ctaHref: string; title: string }) {
  if (!ctaHref) {
    return (
      <section className="mb-6 rounded-xl border border-gray-100 bg-white p-5">
        <h2 className="font-semibold">📊 Statistiques</h2>
        <p className="mt-1 text-sm text-gray-500">Indique le lien du bouton ci-dessous et enregistre : les compteurs apparaîtront ici.</p>
      </section>
    );
  }
  let stats = null;
  try {
    stats = await readPromoStats(statsIdFor(ctaHref));
  } catch {
    // base indisponible : on n'empêche pas d'utiliser le formulaire
  }
  const rate = stats && stats.views > 0 ? (stats.clicks / stats.views) * 100 : null;
  const cards = [
    { label: 'Affichages du pop-up', value: stats ? fmt.format(stats.views) : '—', hint: 'fois où il s’est ouvert chez un visiteur' },
    { label: 'Clics sur le bouton', value: stats ? fmt.format(stats.clicks) : '—', hint: 'visiteurs venus consulter l’offre' },
    {
      label: 'Taux de clic',
      value: rate === null ? '—' : `${rate.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`,
      hint: 'clics ÷ affichages',
    },
  ];
  return (
    <section className="mb-6 rounded-xl border border-gray-100 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">📊 Statistiques de l’offre</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            {title || 'Offre en cours'}
            {stats?.since ? ` · depuis le ${dayFr(stats.since)}` : ''}
          </p>
        </div>
        {stats && (stats.views > 0 || stats.clicks > 0) && <ResetStatsButton ctaHref={ctaHref} />}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg bg-gray-50 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{c.label}</div>
            <div className="mt-1 text-3xl font-extrabold text-gray-900">{c.value}</div>
            <div className="mt-0.5 text-xs text-gray-500">{c.hint}</div>
          </div>
        ))}
      </div>

      {stats && stats.days.length > 0 ? (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500">
                <th className="py-2 pr-4 font-medium">Jour</th>
                <th className="py-2 pr-4 text-right font-medium">Affichages</th>
                <th className="py-2 pr-4 text-right font-medium">Clics</th>
                <th className="py-2 text-right font-medium">Taux</th>
              </tr>
            </thead>
            <tbody>
              {stats.days.slice(0, 14).map((d) => (
                <tr key={d.day} className="border-b border-gray-50">
                  <td className="py-1.5 pr-4">{dayFr(d.day)}</td>
                  <td className="py-1.5 pr-4 text-right tabular-nums">{fmt.format(d.views)}</td>
                  <td className="py-1.5 pr-4 text-right tabular-nums">{fmt.format(d.clicks)}</td>
                  <td className="py-1.5 text-right tabular-nums">
                    {d.views > 0 ? `${Math.round((d.clicks / d.views) * 100)} %` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {stats.days.length > 14 && <p className="mt-2 text-xs text-gray-400">14 derniers jours affichés ; le total ci-dessus compte tout.</p>}
        </div>
      ) : (
        <p className="mt-4 text-sm text-gray-500">Pas encore de données : les compteurs démarrent dès que le pop-up est activé et affiché à un visiteur.</p>
      )}

      <p className="mt-4 text-xs leading-relaxed text-gray-400">
        Compteurs anonymes (ni adresse IP, ni cookie, ni identification). Tes propres visites du site comptent aussi, hors espace admin.
        Les compteurs suivent l’offre (le lien du bouton) : modifier le texte, le prix ou la date ne les remet pas à zéro, changer de produit oui.
      </p>
    </section>
  );
}
