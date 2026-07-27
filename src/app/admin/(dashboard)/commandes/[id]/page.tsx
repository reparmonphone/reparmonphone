import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { formatPrice } from '@/lib/format';
import OrderStatusSelect from './OrderStatusSelect';
import OrderRowActions from '../OrderRowActions';
import ReviewReminderButton from './ReviewReminderButton';
import TrackingForm from './TrackingForm';
import InvoiceActions from '@/components/InvoiceActions';

export default async function AdminOrderDetailPage({ params }: { params: { id: string } }) {
  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: { items: { include: { product: true } } },
  });

  if (!order) notFound();

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-1">Commande #{order.id.slice(-8)}</h1>
      <p className="text-gray-500 mb-6">{new Date(order.createdAt).toLocaleString('fr-FR')}</p>

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
        <div className="space-y-2">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between text-sm">
              <span>
                {item.quantity} × {item.product.title}
              </span>
              <span className="font-medium">{formatPrice(Number(item.unitPrice) * item.quantity)}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-gray-100 mt-4 pt-4 space-y-1">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Sous-total</span>
            <span>{formatPrice(Number(order.subtotal))}</span>
          </div>
          {Number(order.shippingCost) > 0 && (
            <div className="flex justify-between text-sm text-gray-600">
              <span>Livraison</span>
              <span>{formatPrice(Number(order.shippingCost))}</span>
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

      <div className="bg-white border border-gray-100 rounded-xl p-6 mb-4">
        <h2 className="font-semibold mb-3">Statut de la commande</h2>
        <OrderStatusSelect orderId={order.id} currentStatus={order.status} />
        {order.status === 'PENDING' && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <OrderRowActions orderId={order.id} isPending />
          </div>
        )}
        {order.status === 'DELIVERED' && <ReviewReminderButton orderId={order.id} />}
      </div>

      <div className="bg-white border border-gray-100 rounded-xl p-6">
        <h2 className="font-semibold mb-3">Suivi de livraison</h2>
        <TrackingForm
          orderId={order.id}
          carrier={order.carrier}
          trackingNumber={order.trackingNumber ?? ''}
          trackingUrlOverride={order.trackingUrlOverride ?? ''}
        />
      </div>
    </div>
  );
}
