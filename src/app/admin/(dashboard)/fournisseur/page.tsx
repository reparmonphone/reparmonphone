import { prisma } from '@/lib/prisma';
import PriceDecreaseRow from './PriceDecreaseRow';
import SupplierCsvUploadForm from './SupplierCsvUploadForm';

function formatDate(d: Date) {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' }).format(d);
}

// Rapport de la vérification hebdomadaire fournisseur (pieces2mobile.com) — voir
// scripts/weekly-fournisseur-check.js pour la logique de comparaison/correction. Cette page est en
// lecture seule à part la colonne "baisses de prix", la seule catégorie où Krys doit trancher
// (voir actions.ts) : le stock et les hausses de prix sont déjà corrigés en base au moment où cette
// page les affiche.
export default async function AdminFournisseurPage() {
  const lastRun = await prisma.supplierCheckRun.findFirst({ orderBy: { createdAt: 'desc' } });

  const trackedCount = await prisma.product.count({ where: { supplierSku: { not: null } } });
  const totalCount = await prisma.product.count();

  // Baisses de prix : TOUTES celles pas encore traitées, tous runs confondus (elle peut ne pas
  // repasser chaque semaine) — les 3 autres catégories, elles, n'ont rien à traiter : on ne montre
  // que celles du DERNIER run pour ne pas répéter indéfiniment les mêmes lignes déjà appliquées.
  const pendingDecreases = await prisma.supplierCheckItem.findMany({
    where: { type: 'PRIX_BAISSE', reviewed: false },
    include: { product: { select: { title: true, slug: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const lastRunItems = lastRun
    ? await prisma.supplierCheckItem.findMany({
        where: { runId: lastRun.id },
        include: { product: { select: { title: true, slug: true } } },
        orderBy: { createdAt: 'desc' },
      })
    : [];

  const increases = lastRunItems.filter((i) => i.type === 'PRIX_HAUSSE');
  const backInStock = lastRunItems.filter((i) => i.type === 'RETOUR_STOCK');
  const outOfStock = lastRunItems.filter((i) => i.type === 'RUPTURE_STOCK');

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">📊 Comparaison fournisseur</h1>
      <p className="text-gray-500 mb-6">
        Compare ton catalogue au prix et au stock de pieces2mobile.com. Le stock et les hausses de prix fournisseur
        sont corrigés automatiquement à chaque vérification — seules les baisses de prix attendent ta décision,
        ci-dessous. Dépose un export CSV frais avec le bouton ci-dessous (ou en ligne de commande avec{' '}
        <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">node scripts/weekly-fournisseur-check.js</code>, ça
        revient au même).
      </p>

      <SupplierCsvUploadForm />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Dernière vérification</p>
          <p className="font-semibold text-gray-800 text-sm">{lastRun ? formatDate(lastRun.createdAt) : 'Aucune pour le moment'}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Produits suivis</p>
          <p className="font-semibold text-gray-800 text-sm">{trackedCount} / {totalCount}</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-xs text-amber-700 mb-1">Baisses en attente</p>
          <p className="font-semibold text-amber-800 text-lg">{pendingDecreases.length}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Dernier run</p>
          <p className="font-semibold text-gray-800 text-sm">
            {lastRun ? `${increases.length} hausses · ${backInStock.length} retours · ${outOfStock.length} ruptures` : '—'}
          </p>
        </div>
      </div>

      {/* --- Baisses de prix : à traiter --- */}
      <section className="mb-8">
        <h2 className="font-semibold text-gray-800 mb-3">📉 Baisses de prix fournisseur — à valider ({pendingDecreases.length})</h2>
        {pendingDecreases.length === 0 ? (
          <p className="text-gray-400 text-sm">Rien en attente pour le moment.</p>
        ) : (
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-left">
                <tr>
                  <th className="px-4 py-3">Produit</th>
                  <th className="px-4 py-3">Prix fournisseur</th>
                  <th className="px-4 py-3">Ton prix actuel</th>
                  <th className="px-4 py-3">Si tu répercutes la baisse</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pendingDecreases.map((item) => (
                  <PriceDecreaseRow
                    key={item.id}
                    itemId={item.id}
                    title={item.product.title}
                    oldPrice={Number(item.oldPrice)}
                    oldSupplierPrice={Number(item.oldSupplierPrice)}
                    newSupplierPrice={Number(item.newSupplierPrice)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* --- Hausses de prix : déjà appliquées --- */}
      <section className="mb-8">
        <h2 className="font-semibold text-gray-800 mb-3">📈 Hausses de prix fournisseur — déjà corrigées ({increases.length})</h2>
        {increases.length === 0 ? (
          <p className="text-gray-400 text-sm">Aucune hausse lors de la dernière vérification.</p>
        ) : (
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-left">
                <tr>
                  <th className="px-4 py-3">Produit</th>
                  <th className="px-4 py-3">Prix fournisseur</th>
                  <th className="px-4 py-3">Ton prix</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {increases.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800 max-w-[280px]">{item.product.title}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-500">
                      {Number(item.oldSupplierPrice).toFixed(2)}€ → <span className="text-red-600 font-medium">{Number(item.newSupplierPrice).toFixed(2)}€</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {Number(item.oldPrice).toFixed(2)}€ → <span className="font-medium">{Number(item.newPrice).toFixed(2)}€</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* --- Stock : retours + ruptures --- */}
      <div className="grid md:grid-cols-2 gap-6">
        <section>
          <h2 className="font-semibold text-gray-800 mb-3">✅ Retours en stock ({backInStock.length})</h2>
          {backInStock.length === 0 ? (
            <p className="text-gray-400 text-sm">Aucun lors de la dernière vérification.</p>
          ) : (
            <ul className="bg-white border border-gray-100 rounded-xl divide-y divide-gray-100 text-sm">
              {backInStock.map((item) => (
                <li key={item.id} className="px-4 py-2.5 text-gray-700">{item.product.title}</li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="font-semibold text-gray-800 mb-3">⛔ Nouvellement en rupture ({outOfStock.length})</h2>
          {outOfStock.length === 0 ? (
            <p className="text-gray-400 text-sm">Aucun lors de la dernière vérification.</p>
          ) : (
            <ul className="bg-white border border-gray-100 rounded-xl divide-y divide-gray-100 text-sm">
              {outOfStock.map((item) => (
                <li key={item.id} className="px-4 py-2.5 text-gray-700">{item.product.title}</li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
