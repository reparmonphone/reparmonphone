import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { formatPrice } from '@/lib/format';

// Statuts considérés comme du vrai CA encaissé (même définition que /admin/statistiques)
const REVENUE_STATUSES = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'] as const;

const PROVIDER_LABELS: Record<string, string> = { STRIPE: 'Stripe', SUMUP: 'SumUp', PAYPAL: 'PayPal' };

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function startOfYear(d: Date) {
  return new Date(d.getFullYear(), 0, 1);
}

type ComputedOrder = {
  id: string;
  invoiceNumber: number;
  createdAt: Date;
  total: number;
  paymentProvider: string;
  fee: number;
  cost: number;
  shipping: number;
  profit: number;
  isIncomplete: boolean;
};

function sumFor(list: ComputedOrder[], from?: Date) {
  const filtered = from ? list.filter((o) => o.createdAt >= from) : list;
  return {
    revenue: filtered.reduce((s, o) => s + o.total, 0),
    cost: filtered.reduce((s, o) => s + o.cost, 0),
    shipping: filtered.reduce((s, o) => s + o.shipping, 0),
    fee: filtered.reduce((s, o) => s + o.fee, 0),
    profit: filtered.reduce((s, o) => s + o.profit, 0),
    count: filtered.length,
  };
}

export default async function AdminBeneficePage() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const monthStart = startOfMonth(now);
  const yearStart = startOfYear(now);

  const [feeSettings, ordersRaw] = await Promise.all([
    prisma.siteSetting.findMany({
      where: { key: { in: ['fee_rate_stripe', 'fee_rate_sumup', 'fee_rate_paypal'] } },
    }),
    prisma.order.findMany({
      where: { status: { in: [...REVENUE_STATUSES] } },
      select: {
        id: true,
        invoiceNumber: true,
        createdAt: true,
        total: true,
        paymentProvider: true,
        actualShippingCost: true,
        items: { select: { quantity: true, costPrice: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const feeRates: Record<string, number> = {
    STRIPE: Number(feeSettings.find((s) => s.key === 'fee_rate_stripe')?.value ?? 0),
    SUMUP: Number(feeSettings.find((s) => s.key === 'fee_rate_sumup')?.value ?? 0),
    PAYPAL: Number(feeSettings.find((s) => s.key === 'fee_rate_paypal')?.value ?? 0),
  };

  // Bénéfice net = CA (order.total) − coût d'achat fournisseur (saisi par article) − frais de port
  // réels payés (saisis par commande) − frais de la plateforme de paiement (% configuré par moyen de
  // paiement, appliqué au CA). Une commande est "incomplète" tant que le coût d'achat d'au moins un
  // article ou les frais de port réels n'ont pas été renseignés — dans ce cas les champs manquants
  // valent 0, donc le bénéfice affiché est SURESTIMÉ pour cette commande (voir bandeau d'alerte).
  const computed: ComputedOrder[] = ordersRaw.map((o) => {
    const total = Number(o.total);
    const shipping = o.actualShippingCost != null ? Number(o.actualShippingCost) : 0;
    const cost = o.items.reduce((s, it) => s + it.quantity * (it.costPrice != null ? Number(it.costPrice) : 0), 0);
    const fee = total * ((feeRates[o.paymentProvider] ?? 0) / 100);
    const isIncomplete = o.actualShippingCost == null || o.items.some((it) => it.costPrice == null);
    return {
      id: o.id,
      invoiceNumber: o.invoiceNumber,
      createdAt: o.createdAt,
      total,
      paymentProvider: o.paymentProvider,
      fee,
      cost,
      shipping,
      profit: total - fee - cost - shipping,
      isIncomplete,
    };
  });

  const totalStats = sumFor(computed);
  const yearStats = sumFor(computed, yearStart);
  const monthStats = sumFor(computed, monthStart);
  const todayStats = sumFor(computed, todayStart);
  const margin = totalStats.revenue > 0 ? (totalStats.profit / totalStats.revenue) * 100 : 0;

  // Bénéfice net par mois, 12 derniers mois
  const monthBuckets: Record<string, number> = {};
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthBuckets[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`] = 0;
  }
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  for (const o of computed) {
    if (o.createdAt >= twelveMonthsAgo) {
      const key = `${o.createdAt.getFullYear()}-${String(o.createdAt.getMonth() + 1).padStart(2, '0')}`;
      if (key in monthBuckets) monthBuckets[key] += o.profit;
    }
  }
  const maxMonth = Math.max(1, ...Object.values(monthBuckets).map((v) => Math.abs(v)));

  const incompleteOrders = computed.filter((o) => o.isIncomplete).slice(0, 15);
  const incompleteCount = computed.filter((o) => o.isIncomplete).length;

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-1">Bénéfice</h1>
      <p className="text-gray-500 mb-6">
        Calculé ainsi, par commande : chiffre d&apos;affaires − coût d&apos;achat fournisseur − frais de port réels
        payés − frais de la plateforme de paiement (taux réglables sur{' '}
        <Link href="/admin/paiements" className="text-brand hover:underline">Moyens de paiement</Link>).
        Coûts et frais de port visibles admin uniquement, jamais montrés au client.
      </p>

      {incompleteCount > 0 && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-amber-800 mb-1">
            ⚠️ {incompleteCount} commande{incompleteCount > 1 ? 's' : ''} sans coût ou frais de port renseigné
            {incompleteCount > 1 ? 's' : ''}
          </p>
          <p className="text-xs text-amber-700 mb-3">
            Le bénéfice ci-dessous est surestimé pour ces commandes (les coûts manquants comptent pour 0€).
            Renseigne-les pour un bénéfice exact.
          </p>
          <div className="space-y-1">
            {incompleteOrders.map((o) => (
              <Link
                key={o.id}
                href={`/admin/commandes/${o.id}#couts`}
                className="flex justify-between text-xs bg-white/60 hover:bg-white rounded-lg px-3 py-1.5 transition"
              >
                <span className="text-amber-800">Facture #{o.invoiceNumber}</span>
                <span className="text-amber-600">{o.createdAt.toLocaleDateString('fr-FR')} →</span>
              </Link>
            ))}
          </div>
          {incompleteCount > incompleteOrders.length && (
            <p className="text-xs text-amber-600 mt-2">
              + {incompleteCount - incompleteOrders.length} autre(s) — voir{' '}
              <Link href="/admin/commandes" className="underline">toutes les commandes</Link>.
            </p>
          )}
        </div>
      )}

      <h2 className="text-lg font-bold mb-3">💰 Bénéfice net</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total (historique complet)" value={formatPrice(totalStats.profit)} highlight />
        <StatCard label="Aujourd'hui" value={formatPrice(todayStats.profit)} />
        <StatCard label="Ce mois-ci" value={formatPrice(monthStats.profit)} />
        <StatCard label="Cette année" value={formatPrice(yearStats.profit)} />
      </div>

      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden mb-6">
        <h2 className="font-semibold p-5 pb-3">Détail — total historique</h2>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-gray-100">
            <tr>
              <td className="px-5 py-2 text-gray-600">Chiffre d&apos;affaires</td>
              <td className="px-5 py-2 text-right font-medium">{formatPrice(totalStats.revenue)}</td>
            </tr>
            <tr>
              <td className="px-5 py-2 text-gray-600">− Coût d&apos;achat fournisseur</td>
              <td className="px-5 py-2 text-right font-medium text-red-600">− {formatPrice(totalStats.cost)}</td>
            </tr>
            <tr>
              <td className="px-5 py-2 text-gray-600">− Frais de port réels</td>
              <td className="px-5 py-2 text-right font-medium text-red-600">− {formatPrice(totalStats.shipping)}</td>
            </tr>
            <tr>
              <td className="px-5 py-2 text-gray-600">− Frais de plateforme (Stripe/SumUp/PayPal)</td>
              <td className="px-5 py-2 text-right font-medium text-red-600">− {formatPrice(totalStats.fee)}</td>
            </tr>
            <tr>
              <td className="px-5 py-3 font-bold">Bénéfice net</td>
              <td className="px-5 py-3 text-right font-bold">{formatPrice(totalStats.profit)}</td>
            </tr>
            <tr>
              <td className="px-5 py-2 text-gray-400 text-xs">Marge</td>
              <td className="px-5 py-2 text-right text-gray-400 text-xs">{margin.toFixed(1)}%</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl p-6 mb-8">
        <h2 className="font-semibold mb-4">Bénéfice net — 12 derniers mois</h2>
        <div className="flex items-end gap-2 h-40">
          {Object.entries(monthBuckets).map(([month, profit]) => (
            <div key={month} className="flex-1 flex flex-col items-center justify-end h-full">
              <span className="text-[9px] text-gray-500 mb-1 whitespace-nowrap">
                {profit !== 0 ? formatPrice(profit) : ''}
              </span>
              <div
                className={`w-full rounded-t ${profit < 0 ? 'bg-red-500' : 'bg-emerald-600'}`}
                style={{ height: `${Math.max(2, (Math.abs(profit) / maxMonth) * 100)}%` }}
              />
              <span className="text-[10px] text-gray-400 mt-1">
                {new Date(`${month}-01`).toLocaleDateString('fr-FR', { month: 'short' })}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <h2 className="font-semibold p-5 pb-3">Taux de frais actuellement appliqués</h2>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-gray-100">
            {(['STRIPE', 'SUMUP', 'PAYPAL'] as const).map((p) => (
              <tr key={p}>
                <td className="px-5 py-2 text-gray-700">{PROVIDER_LABELS[p]}</td>
                <td className="px-5 py-2 text-right font-medium">{feeRates[p]}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-gray-400 p-5 pt-3">
          Réglables sur <Link href="/admin/paiements" className="text-brand hover:underline">Moyens de paiement</Link>.
        </p>
      </div>
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-5 border ${highlight ? 'bg-brand text-white border-brand' : 'bg-white border-gray-100'}`}>
      <p className={`text-xs ${highlight ? 'text-white/80' : 'text-gray-400'}`}>{label}</p>
      <p className="text-2xl font-extrabold mt-1">{value}</p>
    </div>
  );
}
