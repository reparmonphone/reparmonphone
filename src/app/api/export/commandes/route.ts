import { requireAdminUser } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';
import { toCsv, csvResponse } from '@/lib/csv';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente',
  PAID: 'Payée',
  PROCESSING: 'En préparation',
  SHIPPED: 'Expédiée',
  DELIVERED: 'Livrée',
  CANCELLED: 'Annulée',
  REFUNDED: 'Remboursée',
};

export async function GET() {
  await requireAdminUser();

  const orders = await prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    include: { items: true },
  });

  const rows = orders.map((o) => [
    `${o.createdAt.getFullYear()}-${String(o.invoiceNumber).padStart(5, '0')}`,
    o.customerName,
    o.customerEmail,
    o.customerPhone ?? '',
    STATUS_LABELS[o.status] ?? o.status,
    o.paymentProvider,
    o.items.reduce((sum, i) => sum + i.quantity, 0),
    Number(o.subtotal).toFixed(2),
    Number(o.shippingCost).toFixed(2),
    o.promoCode ?? '',
    Number(o.discountAmount).toFixed(2),
    Number(o.total).toFixed(2),
    `${o.shippingLine1}, ${o.shippingZip} ${o.shippingCity}`,
    o.trackingNumber ?? '',
    o.createdAt.toLocaleDateString('fr-FR'),
  ]);

  const csv = toCsv(
    [
      'N° facture', 'Client', 'Email', 'Téléphone', 'Statut', 'Paiement', 'Nb articles',
      'Sous-total', 'Livraison', 'Code promo', 'Réduction', 'Total', 'Adresse livraison',
      'N° suivi', 'Date',
    ],
    rows
  );

  return csvResponse(csv, `commandes-reparmonphone-${new Date().toISOString().slice(0, 10)}.csv`);
}
