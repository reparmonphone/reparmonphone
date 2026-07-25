import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { formatPrice } from '@/lib/format';
import OrderStatusSelect from './OrderStatusSelect';

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
        <p className="text-sm text-gray-500 mt-2">
          {order.shippingLine1}, {order.shippingZip} {order.shippingCity}
        </p>
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
        <div className="border-t border-gray-100 mt-4 pt-4 flex justify-between font-bold">
          <span>Total</span>
          <span>{formatPrice(Number(order.total))}</span>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl p-6">
        <h2 className="font-semibold mb-3">Statut de la commande</h2>
        <OrderStatusSelect orderId={order.id} currentStatus={order.status} />
      </div>
    </div>
  );
}
