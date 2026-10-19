import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { formatPrice } from '@/lib/format';
import OrderStatusSelect from './OrderStatusSelect';
import OrderRowActions from '../OrderRowActions';
import ReviewReminderButton from './ReviewReminderButton';
import TrackingForm from './TrackingForm';
import InvoiceActions from '@/components/InvoiceActions';
import OrderCostsForm from './OrderCostsForm';
import PartialShipmentsPanel from './PartialShipmentsPanel';
import OrderNotesPanel from './OrderNotesPanel';
import OrderItemsEditor from './OrderItemsEditor';
import NoReviewToggle from '../NoReviewToggle';
import ReviewStatusBadge from '../ReviewStatusBadge';

export default async function AdminOrderDetailPage({ params }: { params: { id: string } }) {
  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      items: { include: { product: true } },
      shipments: {
        include: { items: { include: { orderItem: { include: { product: true } } } } },
        orderBy: { createdAt: 'asc' },
      },
      notes: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!order) notFound();

  // Taux de frais de la plateforme de paiement de CETTE commande (pour l'aperçu du bénéfice dans « Coûts réels »)
  const providerKey = String(order.paymentProvider).toLowerCase();
  const feeSettings = await prisma.siteSetting.findMany({
    where: { key: { in: [`fee_rate_${providerKey}`, `fee_fixed_${providerKey}`] } },
  });
  const feeRate = Number(feeSettings.find((x) => x.key === `fee_rate_${providerKey}`)?.value ?? 0);
  const feeFixed = Number(feeSettings.find((x) => x.key === `fee_fixed_${providerKey}`)?.value ?? 0);
  const providerLabel = ({ STRIPE: 'Stripe', SUMUP: 'SumUp', PAYPAL: 'PayPal' } as Record<string, string>)[String(order.paymentProvider)] ?? String(order.paymentProvider);

  // Mode de livraison : enregistré sur les nouvelles commandes ; pour les anciennes (avant l'ajout de
  // l'info), on le déduit du tarif payé en cherchant les modes de livraison qui ont ce prix.
  let shippingMethodLabel: string | null = order.shippingMethod;
  let shippingMethodGuessed = false;
  if (!shippingMethodLabel && Number(order.shippingCost) > 0) {
    const cost = Number(order.shippingCost);
    const [shippingOptions, zoneRates] = await Promise.all([
      prisma.shippingOption.findMany({ orderBy: { order: 'asc' } }),
      prisma.shippingZoneRate.findMany(),
    ]);
    const matches = shippingOptions
      .filter(
        (o) =>
          Number(o.price) === cost ||
          zoneRates.some((r) => r.shippingOptionId === o.id && Number(r.price) === cost)
      )
      .map((o) => o.label);
    if (matches.length > 0) {
      shippingMethodLabel = matches.join(' ou ');
      shippingMethodGuessed = true;
    }
  }

  const shippedByOrderItem = new Map<string, number>();
  for (const shipment of order.shipments) {
    for (const si of shipment.items) {
      shippedByOrderItem.set(si.orderItemId, (shippedByOrderItem.get(si.orderItemId) ?? 0) + si.quantity);
    }
  }
  const partialShipmentItems = order.items.map((item) => ({
    id: item.id,
    title: item.product.title,
    totalQuantity: item.quantity,
    shippedQuantity: shippedByOrderItem.get(item.id) ?? 0,
  }));
  const partialShipments = order.shipments.map((shipment) => ({
    id: shipment.id,
    carrier: shipment.carrier,
    trackingNumber: shipment.trackingNumber ?? '',
    trackingUrlOverride: shipment.trackingUrlOverride ?? '',
    createdAt: shipment.createdAt.toISOString(),
    items: shipment.items.map((si) => ({
      orderItemId: si.orderItemId,
      title: si.orderItem.product.title,
      quantity: si.quantity,
    })),
  }));

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-1">Commande #{order.id.slice(-8)}</h1>
      <p className="text-gray-500 mb-6">{new Date(order.createdAt).toLocaleString('fr-FR')}</p>

      <div className="bg-white border border-gray-100 rounded-xl p-6 mb-4">
        <h2 className="font-semibold mb-1">✉️ Note pour le client</h2>
        <p className="text-xs text-gray-400 mb-3">
          Pour prévenir le client d&apos;un imprévu (retard transporteur, rupture, etc.) — envoyée par email immédiatement et affichée en permanence dans le détail de sa commande.
        </p>
        <OrderNotesPanel
          orderId={order.id}
          initialNotes={order.notes.map((n) => ({ id: n.id, message: n.message, createdAt: n.createdAt.toISOString() }))}
        />
      </div>

      <div className="bg-white border border-gray-100 rounded-xl p-6 mb-4">
        <h2 className="font-semibold mb-3">Client</h2>
        <p className="text-sm text-gray-700">{order.customerName}</p>
        <p className="text-sm text-gray-500">{order.customerEmail}</p>
        {order.customerPhone && <p className="text-sm text-gray-500">{order.customerPhone}</p>}
        {order.paymentBrand && (
          <p className="text-sm text-gray-500 mt-1">
            💳{' '}
            {order.paymentProvider === 'SUMUP'
              ? 'SumUp'
              : order.paymentProvider === 'PAYPAL'
                ? 'PayPal'
                : order.paymentBrand.toUpperCase()}
            {order.paymentLast4 ? ` terminant par ${order.paymentLast4}` : ''}
          </p>
        )}

        <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Livraison</p>
            <p className="text-sm text-gray-600">
              {order.shippingLine1}<br />
              {order.shippingZip} {order.shippingCity}
            </p>
            {shippingMethodLabel && (
              <p className="text-xs text-gray-500 mt-2">
                🚚 {shippingMethodLabel}
                {shippingMethodGuessed && <span className="text-gray-400"> (déduit du tarif)</span>}
              </p>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Facturation</p>
            {order.billingLine1 ? (
              <p className="text-sm text-gray-600">
                {order.billingName && <>{order.billingName}<br /></>}
                {order.billingLine1}<br />
                {order.billingZip} {order.billingCity}
              </p>
            ) : (
              <p className="text-sm text-gray-400">Identique à la livraison</p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl p-6 mb-4">
        <h2 className="font-semibold mb-3">Articles</h2>
        <OrderItemsEditor
          orderId={order.id}
          canEdit={['PENDING', 'PAID', 'PROCESSING'].includes(order.status)}
          items={order.items.map((item) => ({
            id: item.id,
            title: item.product.title,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
          }))}
        />
        <div className="border-t border-gray-100 mt-4 pt-4 space-y-1">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Sous-total</span>
            <span>{formatPrice(Number(order.subtotal))}</span>
          </div>
          {(Number(order.shippingCost) > 0 || shippingMethodLabel) && (
            <div className="flex justify-between text-sm text-gray-600">
              <span>
                Livraison
                {shippingMethodLabel ? ` — ${shippingMethodLabel}` : ''}
                {shippingMethodGuessed ? ' (déduit du tarif)' : ''}
              </span>
              <span>{Number(order.shippingCost) > 0 ? formatPrice(Number(order.shippingCost)) : 'Offerte'}</span>
            </div>
          )}
          {order.promoCode && (
            <div className="flex justify-between text-sm text-green-700">
              <span>Réduction ({order.promoCode})</span>
              <span>− {formatPrice(Number(order.discountAmount))}</span>
            </div>
          )}
          <div className="flex justify-between font-bold pt-1">
            <span>Total</span>
            <span>{formatPrice(Number(order.total))}</span>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl p-6 mb-4">
        <h2 className="font-semibold mb-3">Facture</h2>
        <InvoiceActions orderId={order.id} allowCustomEmail />
      </div>

      <OrderCostsForm
        orderId={order.id}
        items={order.items.map((item) => ({
          id: item.id,
          label: item.product.title,
          quantity: item.quantity,
          costPrice: item.costPrice != null ? Number(item.costPrice) : null,
        }))}
        actualShippingCost={order.actualShippingCost != null ? Number(order.actualShippingCost) : null}
        orderTotal={Number(order.total)}
        refunded={order.status === 'REFUNDED'}
        feeRate={feeRate}
        feeFixed={feeFixed}
        providerLabel={providerLabel}
      />

      <div className="bg-white border border-gray-100 rounded-xl p-6 mb-4">
        <h2 className="font-semibold mb-3">Statut de la commande</h2>
        <OrderStatusSelect orderId={order.id} currentStatus={order.status} />
        {order.status === 'PENDING' && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <OrderRowActions orderId={order.id} isPending />
          </div>
        )}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <NoReviewToggle orderId={order.id} initialValue={order.noReviewRequest} />
        </div>
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-500 mb-1">Demande d&apos;avis</p>
          <ReviewStatusBadge
            status={order.status}
            noReviewRequest={order.noReviewRequest}
            reviewReminderSentAt={order.reviewReminderSentAt}
            reviewAutoSentAt={order.reviewAutoSentAt}
            reviewRelanceCount={order.reviewRelanceCount}
            deliveredAt={order.deliveredAt}
            createdAt={order.createdAt}
          />
        </div>
        {order.status === 'DELIVERED' && !order.noReviewRequest && <ReviewReminderButton orderId={order.id} />}
      </div>

      <div className="bg-white border border-gray-100 rounded-xl p-6 mb-4">
        <h2 className="font-semibold mb-3">Suivi de livraison</h2>
        <p className="text-xs text-gray-400 mb-3">
          À utiliser quand la commande part en un seul colis. Pour une commande expédiée en plusieurs fois, utilisez plutôt la section &laquo;&nbsp;Livraison partielle&nbsp;&raquo; ci-dessous.
        </p>
        <TrackingForm
          orderId={order.id}
          carrier={order.carrier}
          trackingNumber={order.trackingNumber ?? ''}
          trackingUrlOverride={order.trackingUrlOverride ?? ''}
        />
      </div>

      <div className="bg-white border border-gray-100 rounded-xl p-6">
        <h2 className="font-semibold mb-1">📦 Livraison partielle</h2>
        <p className="text-xs text-gray-400 mb-4">
          Quand un article n&apos;est pas disponible tout de suite : répartissez la commande en plusieurs envois, chacun avec son propre numéro de suivi, au fur et à mesure que le stock arrive.
        </p>
        <PartialShipmentsPanel orderId={order.id} orderItems={partialShipmentItems} shipments={partialShipments} />
      </div>
    </div>
  );
}
