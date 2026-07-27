import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';
import { formatPrice } from '@/lib/format';
import { CARRIER_LABELS, buildTrackingUrl } from '@/lib/tracking';
import ReorderButton from './ReorderButton';
import InvoiceActions from '@/components/InvoiceActions';
import ProductReviewForm from '@/components/ProductReviewForm';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente de paiement',
  PAID: 'Payée',
  PROCESSING: 'En préparation',
  SHIPPED: 'Expédiée',
  DELIVERED: 'Livrée',
  CANCELLED: 'Annulée',
  REFUNDED: 'Remboursée',
};

export default async function CommandeDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/compte/connexion');

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: { items: { include: { product: true } } },
  });

  // Sécurité : la commande doit appartenir au client connecté (par userId, ou par email pour les commandes invité)
  if (!order || (order.userId !== user.id && order.customerEmail !== user.email)) {
    notFound();
  }

  const trackingUrl = buildTrackingUrl(order.carrier, order.trackingNumber, order.trackingUrlOverride);

  // Pour savoir, produit par produit, si le client a déjà laissé un avis (et donc masquer le formulaire)
  const existingReviews =
    order.status === 'DELIVERED'
      ? await prisma.productReview.findMany({
          where: { userId: user.id, productId: { in: order.items.map((i) => i.productId) } },
          select: { productId: true },
        })
      : [];
  const reviewedProductIds = new Set(existingReviews.map((r) => r.productId));

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <Link href="/compte/commandes" className="text-sm text-gray-500 hover:text-gray-800">← Mes commandes</Link>

      <div className="flex items-center justify-between mt-2 mb-1">
        <h1 className="text-2xl font-bold">Commande #{order.id.slice(-8)}</h1>
        <span className="text-xs bg-gray-100 px-2.5 py-1 rounded-full font-medium">{STATUS_LABELS[order.status]}</span>
      </div>
      <p className="text-gray-500 mb-8">{new Date(order.createdAt).toLocaleString('fr-FR')}</p>

      {/* Suivi de livraison */}
      {order.carrier && order.trackingNumber && (
        <div className="bg-brand-light border border-brand/20 rounded-xl p-5 mb-6">
          <h2 className="font-semibold mb-1">📦 Suivi de livraison</h2>
          <p className="text-sm text-gray-700">
            {CARRIER_LABELS[order.carrier]} — n° <span className="font-mono">{order.trackingNumber}</span>
          </p>
          {trackingUrl && (
            <a
              href={trackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-3 bg-brand text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-brand-dark transition"
            >
              Suivre mon colis →
            </a>
          )}
        </div>
      )}

      {/* Articles */}
      <div className="bg-white border border-gray-100 rounded-xl p-6 mb-6">
        <h2 className="font-semibold mb-4">Articles</h2>
        <div className="space-y-4">
          {order.items.map((item) => (
            <div key={item.id}>
              <div className="flex items-center gap-4">
                <div className="relative w-14 h-14 shrink-0 bg-gray-50 rounded-lg">
                  {item.product.imageUrl && (
                    <Image src={item.product.imageUrl} alt={item.product.title} fill className="object-contain p-1" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-800">{item.product.title}</p>
                  <p className="text-xs text-gray-500">Qté : {item.quantity}</p>
                </div>
                <span className="font-medium text-sm">{formatPrice(Number(item.unitPrice) * item.quantity)}</span>
              </div>

              {order.status === 'DELIVERED' && (
                <div className="mt-3 ml-[72px]">
                  {reviewedProductIds.has(item.productId) ? (
                    <p className="text-xs text-green-600">✅ Tu as déjà laissé un avis sur ce produit — merci !</p>
                  ) : (
                    <ProductReviewForm productId={item.productId} compact />
                  )}
                </div>
              )}
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

      {/* Facture */}
      <div className="bg-white border border-gray-100 rounded-xl p-6 mb-6">
        <h2 className="font-semibold mb-3">Facture</h2>
        {order.paymentBrand && (
          <p className="text-sm text-gray-600 mb-3">
            💳 Payé par{' '}
            {order.paymentProvider === 'SUMUP'
              ? 'carte via SumUp'
              : order.paymentProvider === 'PAYPAL'
                ? 'PayPal'
                : `carte ${order.paymentBrand.toUpperCase()}`}
            {order.paymentLast4 ? ` terminant par ${order.paymentLast4}` : ''}
          </p>
        )}
        <InvoiceActions orderId={order.id} />
      </div>

      {/* Adresses */}
      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-white border border-gray-100 rounded-xl p-6">
          <h2 className="font-semibold mb-2">Adresse de livraison</h2>
          <p className="text-sm text-gray-600">{order.customerName}</p>
          <p className="text-sm text-gray-600">{order.shippingLine1}</p>
          <p className="text-sm text-gray-600">{order.shippingZip} {order.shippingCity}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-6">
          <h2 className="font-semibold mb-2">Adresse de facturation</h2>
          {order.billingLine1 ? (
            <>
              <p className="text-sm text-gray-600">{order.billingName ?? order.customerName}</p>
              <p className="text-sm text-gray-600">{order.billingLine1}</p>
              <p className="text-sm text-gray-600">{order.billingZip} {order.billingCity}</p>
            </>
          ) : (
            <p className="text-sm text-gray-400">Identique à la livraison</p>
          )}
        </div>
      </div>

      <ReorderButton
        items={order.items.map((item) => ({
          productId: item.productId,
          slug: item.product.slug,
          title: item.product.title,
          price: Number(item.product.price),
          imageUrl: item.product.imageUrl,
          quantity: item.quantity,
          inStock: item.product.inStock,
        }))}
      />
    </div>
  );
}
