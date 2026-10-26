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
    include: {
      items: { include: { product: true } },
      shipments: {
        include: { items: { include: { orderItem: { include: { product: true } } } } },
        orderBy: { createdAt: 'asc' },
      },
      notes: { orderBy: { createdAt: 'desc' } },
      replacementOf: { select: { id: true } },
      replacements: { select: { id: true, status: true }, orderBy: { createdAt: 'desc' } },
    },
  });

  // Sécurité : la commande doit appartenir au client connecté (par userId, ou par email pour les commandes invité)
  if (!order || (order.userId !== user.id && order.customerEmail !== user.email)) {
    notFound();
  }

  const isReplacement = !!order.replacementOfId;
  const statusLabel = isReplacement
    ? ({ PROCESSING: 'En préparation', PAID: 'En préparation', SHIPPED: 'En livraison', DELIVERED: 'Livré', CANCELLED: 'Annulé' } as Record<string, string>)[order.status] ??
      STATUS_LABELS[order.status]
    : STATUS_LABELS[order.status];
  const trackingUrl = buildTrackingUrl(order.carrier, order.trackingNumber, order.trackingUrlOverride);
  // Livraison partielle : si la commande a été répartie en plusieurs envois, on affiche le détail
  // de chaque colis (articles + suivi) à la place du bloc de suivi unique classique.
  const hasPartialShipments = order.shipments.length > 0;

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
        <h1 className="text-2xl font-bold">
          {isReplacement ? '🔁 Renvoi' : 'Commande'} #{order.id.slice(-8)}
        </h1>
        <span className="text-xs bg-gray-100 px-2.5 py-1 rounded-full font-medium">{statusLabel}</span>
      </div>
      <p className="text-gray-500 mb-8">{new Date(order.createdAt).toLocaleString('fr-FR')}</p>

      {/* Renvoi : nouvelle expédition gratuite liée à une commande d'origine */}
      {isReplacement && order.replacementOf && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-5 mb-6">
          <h2 className="font-semibold mb-1 text-purple-900">🔁 Nouvel envoi offert</h2>
          <p className="text-sm text-gray-700">
            Cet envoi est lié à votre commande{' '}
            <Link href={`/compte/commandes/${order.replacementOf.id}`} className="text-brand font-medium hover:underline">
              #{order.replacementOf.id.slice(-8)}
            </Link>
            . Il est <strong>entièrement offert</strong> : aucun paiement ni frais de port.
          </p>
        </div>
      )}
      {!isReplacement && order.replacements.length > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-5 mb-6">
          <h2 className="font-semibold mb-1 text-purple-900">🔁 Un nouvel envoi est prévu pour cette commande</h2>
          <ul className="text-sm text-gray-700 space-y-1">
            {order.replacements.map((r) => (
              <li key={r.id}>
                <Link href={`/compte/commandes/${r.id}`} className="text-brand font-medium hover:underline">
                  Suivre le renvoi #{r.id.slice(-8)}
                </Link>{' '}
                —{' '}
                {({ PROCESSING: 'en préparation', PAID: 'en préparation', SHIPPED: 'en livraison', DELIVERED: 'livré', CANCELLED: 'annulé' } as Record<string, string>)[r.status] ?? r.status}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Notes de la boutique sur cette commande (imprévus, retards...) — toujours en premier, avant
          même le suivi de livraison, car c'est l'info la plus importante quand elle existe. */}
      {order.notes.length > 0 && (
        <div className="space-y-3 mb-6">
          {order.notes.map((note) => (
            <div key={note.id} className="bg-amber-50 border border-amber-200 rounded-xl p-5">
              <h2 className="font-semibold mb-1 text-amber-900">ℹ️ Information sur votre commande</h2>
              <p className="text-sm text-gray-700 whitespace-pre-line">{note.message}</p>
              <p className="text-xs text-gray-400 mt-2">
                {new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' }).format(note.createdAt)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Suivi de livraison */}
      {hasPartialShipments ? (
        <div className="bg-brand-light border border-brand/20 rounded-xl p-5 mb-6">
          <h2 className="font-semibold mb-1">📦 Votre commande est expédiée en plusieurs colis</h2>
          <p className="text-xs text-gray-500 mb-3">Certains articles n&apos;étaient pas disponibles en même temps, votre commande vous parvient donc en {order.shipments.length} envoi{order.shipments.length > 1 ? 's' : ''}.</p>
          <div className="space-y-3">
            {order.shipments.map((shipment, i) => {
              const shipmentTrackingUrl = buildTrackingUrl(shipment.carrier, shipment.trackingNumber, shipment.trackingUrlOverride);
              return (
                <div key={shipment.id} className="bg-white rounded-lg p-4 border border-brand/10">
                  <p className="text-sm font-medium text-gray-800 mb-1">Colis {i + 1}</p>
                  <ul className="text-xs text-gray-500 mb-2">
                    {shipment.items.map((si) => (
                      <li key={si.orderItemId}>{si.quantity} × {si.orderItem.product.title}</li>
                    ))}
                  </ul>
                  {shipment.carrier && shipment.trackingNumber ? (
                    <>
                      <p className="text-sm text-gray-700">
                        {CARRIER_LABELS[shipment.carrier]} — n° <span className="font-mono">{shipment.trackingNumber}</span>
                      </p>
                      {shipmentTrackingUrl && (
                        <a
                          href={shipmentTrackingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block mt-2 bg-brand text-white px-4 py-1.5 rounded-lg text-xs font-semibold hover:bg-brand-dark transition"
                        >
                          Suivre ce colis →
                        </a>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-gray-400">Numéro de suivi à venir</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        order.carrier && order.trackingNumber && (
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
        )
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
                <span className="font-medium text-sm">{isReplacement ? 'Offert' : formatPrice(Number(item.unitPrice) * item.quantity)}</span>
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
        {isReplacement ? (
          <div className="border-t border-gray-100 mt-4 pt-4 flex justify-between font-bold">
            <span>Total</span>
            <span>Offert</span>
          </div>
        ) : (
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
        )}
      </div>

      {/* Facture (pas de facture pour un renvoi gratuit) */}
      {!isReplacement && (
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
      )}

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

      {!isReplacement && <ReorderButton
        items={order.items.map((item) => ({
          productId: item.productId,
          slug: item.product.slug,
          title: item.product.title,
          price: Number(item.product.price),
          imageUrl: item.product.imageUrl,
          quantity: item.quantity,
          inStock: item.product.inStock,
        }))}
      />}
    </div>
  );
}
