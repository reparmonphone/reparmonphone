import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { formatPrice } from '@/lib/format';

// Statuts considérés comme du vrai CA encaissé (même définition que /admin/statistiques)
const REVENUE_STATUSES = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'] as const;
// Commandes remboursées au client : le CA est rendu (compté 0), mais les frais de la plateforme de
// paiement ne sont en général pas restitués, et le coût d'achat / frais de port éventuellement déjà
// saisis sont dépensés pour rien. Ces commandes comptent donc comme une PERTE dans le bénéfice.
const REFUNDED_STATUS = 'REFUNDED';

const PROVIDER_LABELS: Record<string, string> = { STRIPE: 'Stripe', SUMUP: 'SumUp', PAYPAL: 'PayPal' };

// Les coûts réels admin (coût d'achat fournisseur, frais de port réels) sont saisis HT — la TVA à
// 20% est ajoutée ici pour obtenir le coût réel TTC utilisé dans le calcul du bénéfice.
const VAT_RATE = 0.2;

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
  customerName: string;
  shippingPaid: number; // livraison facturée au client (info)
  status: string;
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
  refunded: boolean;
};

function sumFor(list: ComputedOrder[], from?: Date) {
  const filtered = from ? list.filter((o) => o.createdAt >= from) : list;
  const refundedList = filtered.filter((o) => o.refunded);
  return {
    // Une commande remboursée n'apporte aucun CA (total = 0 pour elle, voir computed plus bas).
    revenue: filtered.reduce((s, o) => s + o.total, 0),
    refundCount: refundedList.length,
    refundLoss: refundedList.reduce((s, o) => s + o.profit, 0), // négatif : perte sur remboursements
    cost: filtered.reduce((s, o) => s + o.cost, 0),
    shipping: filtered.reduce((s, o) => s + o.shipping, 0),
    fee: filtered.reduce((s, o) => s + o.fee, 0),
    profit: filtered.reduce((s, o) => s + o.profit, 0),
    count: filtered.length,
  };
}

const TZ = 'Europe/Paris';
const dayKey = (d: Date) => new Intl.DateTimeFormat('fr-CA', { timeZone: TZ }).format(d); // AAAA-MM-JJ
const dayLabel = (d: Date) =>
  new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d);
const timeLabel = (d: Date) => new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(d);
const monthLabel = (key: string) =>
  new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(new Date(`${key}-01T12:00:00Z`));

export default async function AdminBeneficePage({ searchParams }: { searchParams?: { mois?: string } }) {
  const now = new Date();
  const todayStart = startOfDay(now);
  const monthStart = startOfMonth(now);
  const yearStart = startOfYear(now);

  const [feeSettings, ordersRaw] = await Promise.all([
    prisma.siteSetting.findMany({
      where: {
        key: {
          in: [
            'fee_rate_stripe',
            'fee_rate_sumup',
            'fee_rate_paypal',
            'fee_fixed_stripe',
            'fee_fixed_sumup',
            'fee_fixed_paypal',
          ],
        },
      },
    }),
    prisma.order.findMany({
      where: { status: { in: [...REVENUE_STATUSES, REFUNDED_STATUS] } },
      // (le type Prisma de "status" est l'enum OrderStatus : REFUNDED en fait partie)
      select: {
        id: true,
        invoiceNumber: true,
        createdAt: true,
        total: true,
        customerName: true,
        shippingCost: true,
        status: true,
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
  // Montant fixe (€) prélevé en plus du pourcentage sur chaque commande (ex : PayPal = 2,90 % + 0,35 €).
  const feeFixed: Record<string, number> = {
    STRIPE: Number(feeSettings.find((s) => s.key === 'fee_fixed_stripe')?.value ?? 0),
    SUMUP: Number(feeSettings.find((s) => s.key === 'fee_fixed_sumup')?.value ?? 0),
    PAYPAL: Number(feeSettings.find((s) => s.key === 'fee_fixed_paypal')?.value ?? 0),
  };

  // Bénéfice net = CA (order.total) − coût d'achat fournisseur (saisi HT par article, TVA 20% ajoutée)
  // − frais de port réels payés (saisis HT par commande, TVA 20% ajoutée) − frais de la plateforme de
  // paiement (% configuré par moyen de paiement, appliqué au CA). Une commande est "incomplète" tant
  // que le coût d'achat d'au moins un article ou les frais de port réels n'ont pas été renseignés —
  // dans ce cas les champs manquants valent 0, donc le bénéfice affiché est SURESTIMÉ pour cette
  // commande (voir bandeau d'alerte).
  //
  // Commande REMBOURSÉE : le client a récupéré son argent, donc CA = 0, mais les frais de la plateforme
  // de paiement (calculés sur le montant d'origine) restent à ta charge, ainsi que le coût d'achat et
  // les frais de port DÉJÀ saisis. Cas fréquent : article en rupture chez le fournisseur → rien n'a été
  // acheté ni expédié, les coûts ne sont pas saisis (valent 0) et la perte = les frais de paiement.
  const computed: ComputedOrder[] = ordersRaw.map((o) => {
    const refunded = o.status === REFUNDED_STATUS;
    const originalTotal = Number(o.total);
    const total = refunded ? 0 : originalTotal;
    const shippingHT = o.actualShippingCost != null ? Number(o.actualShippingCost) : 0;
    const costHT = o.items.reduce((s, it) => s + it.quantity * (it.costPrice != null ? Number(it.costPrice) : 0), 0);
    const shipping = shippingHT * (1 + VAT_RATE);
    const cost = costHT * (1 + VAT_RATE);
    const fee = originalTotal * ((feeRates[o.paymentProvider] ?? 0) / 100) + (feeFixed[o.paymentProvider] ?? 0);
    // Une commande remboursée n'est jamais "incomplète" : des coûts non saisis y sont normaux.
    const isIncomplete = !refunded && (o.actualShippingCost == null || o.items.some((it) => it.costPrice == null));
    return {
      customerName: o.customerName,
      shippingPaid: Number(o.shippingCost ?? 0),
      status: o.status,
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
      refunded,
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

  // ── Détail par jour (filtre par mois : ?mois=AAAA-MM, ou ?mois=tout) ──
  const monthKeys: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  const wanted = searchParams?.mois;
  const selectedMonth = wanted === 'tout' ? 'tout' : wanted && /^\d{4}-\d{2}$/.test(wanted) ? wanted : monthKeys[0];
  const detailOrders = computed.filter((o) => selectedMonth === 'tout' || dayKey(o.createdAt).startsWith(selectedMonth));
  const days: { key: string; date: Date; orders: ComputedOrder[]; stats: ReturnType<typeof sumFor> }[] = [];
  for (const o of detailOrders) {
    // computed est trié du plus récent au plus ancien
    const key = dayKey(o.createdAt);
    let g = days[days.length - 1];
    if (!g || g.key !== key) {
      g = { key, date: o.createdAt, orders: [], stats: sumFor([]) };
      days.push(g);
    }
    g.orders.push(o);
  }
  for (const g of days) g.stats = sumFor(g.orders);
  const detailStats = sumFor(detailOrders);

  const incompleteOrders = computed.filter((o) => o.isIncomplete).slice(0, 15);
  const incompleteCount = computed.filter((o) => o.isIncomplete).length;

  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-bold mb-1">Bénéfice</h1>
      <p className="text-gray-500 mb-6">
        Calculé ainsi, par commande : chiffre d&apos;affaires − coût d&apos;achat fournisseur − frais de port réels
        payés − frais de la plateforme de paiement (taux réglables sur{' '}
        <Link href="/admin/paiements" className="text-brand hover:underline">Moyens de paiement</Link>).
        Coûts et frais de port visibles admin uniquement, jamais montrés au client. Tu peux les saisir en HT
        ou en TTC sur la commande (conversion automatique) ; ils sont enregistrés en HT et la TVA à 20% est
        ajoutée dans ce calcul pour obtenir ce que tu paies réellement.
        Une commande passée en « Remboursée » ne rapporte plus de chiffre d&apos;affaires, mais compte comme une
        perte : frais de la plateforme de paiement (non restitués) et coûts déjà saisis.
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
              <td className="px-5 py-2 text-gray-600">− Coût d&apos;achat fournisseur (HT + TVA 20%)</td>
              <td className="px-5 py-2 text-right font-medium text-red-600">− {formatPrice(totalStats.cost)}</td>
            </tr>
            <tr>
              <td className="px-5 py-2 text-gray-600">− Frais de port réels (HT + TVA 20%)</td>
              <td className="px-5 py-2 text-right font-medium text-red-600">− {formatPrice(totalStats.shipping)}</td>
            </tr>
            <tr>
              <td className="px-5 py-2 text-gray-600">− Frais de plateforme (Stripe/SumUp/PayPal, % + fixe)</td>
              <td className="px-5 py-2 text-right font-medium text-red-600">− {formatPrice(totalStats.fee)}</td>
            </tr>
            <tr>
              <td className="px-5 py-3 font-bold">Bénéfice net</td>
              <td className="px-5 py-3 text-right font-bold">{formatPrice(totalStats.profit)}</td>
            </tr>
            {totalStats.refundCount > 0 && (
              <tr>
                <td className="px-5 py-2 text-gray-500 text-xs">
                  dont pertes sur remboursements ({totalStats.refundCount} commande{totalStats.refundCount > 1 ? 's' : ''}{' '}
                  remboursée{totalStats.refundCount > 1 ? 's' : ''} : frais de paiement non rendus + coûts déjà engagés)
                </td>
                <td className="px-5 py-2 text-right text-xs font-medium text-red-600">
                  {formatPrice(totalStats.refundLoss)}
                </td>
              </tr>
            )}
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

      <h2 className="text-lg font-bold mb-1">🧾 Détail par commande, jour par jour</h2>
      <p className="text-xs text-gray-500 mb-3">
        Pour chaque commande : chiffre d&apos;affaires − coût d&apos;achat − port réel − frais de paiement = bénéfice
        (coûts avec TVA 20 % ajoutée). Les commandes annulées ou non payées ne sont pas comptées.
      </p>
      <div className="flex flex-wrap gap-2 mb-4">
        {monthKeys.map((m) => (
          <Link
            key={m}
            href={`/admin/benefice?mois=${m}`}
            className={`px-3 py-1.5 rounded-lg text-xs border transition ${
              selectedMonth === m ? 'bg-brand text-white border-brand' : 'bg-white text-gray-600 border-gray-200 hover:border-brand'
            }`}
          >
            {monthLabel(m)}
          </Link>
        ))}
        <Link
          href="/admin/benefice?mois=tout"
          className={`px-3 py-1.5 rounded-lg text-xs border transition ${
            selectedMonth === 'tout' ? 'bg-brand text-white border-brand' : 'bg-white text-gray-600 border-gray-200 hover:border-brand'
          }`}
        >
          Tout l&apos;historique
        </Link>
      </div>

      {days.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-xl p-6 text-sm text-gray-500 mb-8">
          Aucune commande sur cette période.
        </div>
      ) : (
        <div className="space-y-4 mb-8">
          <div className="flex justify-between text-sm bg-gray-50 border border-gray-100 rounded-xl px-5 py-3">
            <span className="text-gray-600">
              {selectedMonth === 'tout' ? 'Tout l’historique' : monthLabel(selectedMonth)} — {detailStats.count} commande
              {detailStats.count > 1 ? 's' : ''} · CA {formatPrice(detailStats.revenue)}
            </span>
            <span className={`font-bold ${detailStats.profit < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
              Bénéfice : {formatPrice(detailStats.profit)}
            </span>
          </div>

          {days.map((g) => (
            <div key={g.key} className="bg-white border border-gray-100 rounded-xl overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 bg-gray-50 border-b border-gray-100">
                <h3 className="font-semibold text-gray-800 capitalize">{dayLabel(g.date)}</h3>
                <p className="text-xs text-gray-500">
                  {g.stats.count} commande{g.stats.count > 1 ? 's' : ''} · CA {formatPrice(g.stats.revenue)} ·{' '}
                  <span className={`font-bold text-sm ${g.stats.profit < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                    bénéfice {formatPrice(g.stats.profit)}
                  </span>
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-400 text-left">
                      <th className="px-5 py-2 font-medium">Commande</th>
                      <th className="px-3 py-2 font-medium">Paiement</th>
                      <th className="px-3 py-2 font-medium text-right">CA</th>
                      <th className="px-3 py-2 font-medium text-right">− Achat</th>
                      <th className="px-3 py-2 font-medium text-right">− Port réel</th>
                      <th className="px-3 py-2 font-medium text-right">− Frais paiement</th>
                      <th className="px-5 py-2 font-medium text-right">= Bénéfice</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {g.orders.map((o) => (
                      <tr key={o.id} className={o.refunded ? 'bg-red-50/40' : undefined}>
                        <td className="px-5 py-2.5">
                          <Link href={`/admin/commandes/${o.id}#couts`} className="text-brand hover:underline font-medium">
                            #{o.invoiceNumber}
                          </Link>{' '}
                          <span className="text-gray-400 text-xs">{timeLabel(o.createdAt)}</span>
                          <div className="text-xs text-gray-600">{o.customerName}</div>
                          {o.refunded && <div className="text-[11px] font-semibold text-red-600">Remboursée — CA rendu, frais non restitués</div>}
                          {o.isIncomplete && (
                            <Link href={`/admin/commandes/${o.id}#couts`} className="text-[11px] font-semibold text-amber-600 hover:underline">
                              ⚠️ coût ou port non renseigné
                            </Link>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-gray-600">{PROVIDER_LABELS[o.paymentProvider] ?? o.paymentProvider}</td>
                        <td className="px-3 py-2.5 text-right">
                          {formatPrice(o.total)}
                          {o.shippingPaid > 0 && !o.refunded && (
                            <div className="text-[11px] text-gray-400">livraison client : {formatPrice(o.shippingPaid)}</div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right text-red-600">{o.cost > 0 ? `− ${formatPrice(o.cost)}` : '—'}</td>
                        <td className="px-3 py-2.5 text-right text-red-600">{o.shipping > 0 ? `− ${formatPrice(o.shipping)}` : '—'}</td>
                        <td className="px-3 py-2.5 text-right text-red-600">{o.fee > 0 ? `− ${formatPrice(o.fee)}` : '—'}</td>
                        <td className={`px-5 py-2.5 text-right font-bold ${o.profit < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                          {formatPrice(o.profit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <h2 className="font-semibold p-5 pb-3">Taux de frais actuellement appliqués</h2>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-gray-100">
            {(['STRIPE', 'SUMUP', 'PAYPAL'] as const).map((p) => (
              <tr key={p}>
                <td className="px-5 py-2 text-gray-700">{PROVIDER_LABELS[p]}</td>
                <td className="px-5 py-2 text-right font-medium">
                  {feeRates[p]}% {feeFixed[p] > 0 && `+ ${feeFixed[p]}€`}
                </td>
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
