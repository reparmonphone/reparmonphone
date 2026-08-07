import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import ClaimResolutionForm from './ClaimResolutionForm';

function getPaymentDashboardLink(order: {
  paymentProvider: string | null;
  stripePaymentIntentId: string | null;
  sumupCheckoutId: string | null;
  paypalOrderId: string | null;
}) {
  if (order.paymentProvider === 'stripe' && order.stripePaymentIntentId) {
    return {
      label: 'Ouvrir ce paiement dans Stripe',
      url: `https://dashboard.stripe.com/payments/${order.stripePaymentIntentId}`,
      id: order.stripePaymentIntentId,
    };
  }
  if (order.paymentProvider === 'sumup' && order.sumupCheckoutId) {
    return {
      // SumUp n'a pas de lien direct prévisible vers une transaction précise — on ouvre le
      // tableau des transactions et on affiche l'ID à rechercher manuellement.
      label: 'Ouvrir le tableau de bord SumUp',
      url: 'https://me.sumup.com/en-gb/receipts',
      id: order.sumupCheckoutId,
    };
  }
  if (order.paymentProvider === 'paypal' && order.paypalOrderId) {
    return {
      label: "Ouvrir l'activité PayPal",
      url: 'https://www.paypal.com/myaccount/activities/',
      id: order.paypalOrderId,
    };
  }
  return null;
}

export default async function AdminLitigeDetailPage({ params }: { params: { id: string } }) {
  const claim = await prisma.claim.findUnique({
    where: { id: params.id },
    include: { order: true },
  });
  if (!claim) notFound();

  const paymentLink = getPaymentDashboardLink(claim.order);

  return (
    <div className="max-w-3xl">
      <Link href="/admin/litiges" className="text-sm text-gray-400 hover:text-brand">← Retour aux litiges</Link>
      <h1 className="text-2xl font-bold mt-2 mb-6">Litige — {claim.order.customerName}</h1>

      <div className="bg-white border border-gray-100 rounded-xl p-5 mb-6">
        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-xs text-gray-400">Client</p>
            <p className="font-medium text-gray-800">{claim.order.customerName}</p>
            <p className="text-sm text-gray-500">
              <a href={`mailto:${claim.customerEmail}`} className="text-brand hover:underline">{claim.customerEmail}</a>
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Commande</p>
            <p className="font-medium text-gray-800">
              #{claim.order.invoiceNumber || claim.order.id.slice(-8)} — {Number(claim.order.total).toFixed(2)}€
            </p>
            <p className="text-sm text-gray-500">Moyen de paiement : {claim.order.paymentProvider ?? '—'}</p>
          </div>
        </div>

        {paymentLink && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-amber-800">
              💰 Pour un vrai remboursement, effectue-le directement ici :{' '}
              <a href={paymentLink.url} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
                {paymentLink.label}
              </a>
            </p>
            <p className="text-xs text-amber-700 mt-1">Référence du paiement : {paymentLink.id}</p>
          </div>
        )}

        <div className="mb-4">
          <p className="text-xs text-gray-400 mb-1">Description du problème</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg p-3">{claim.description}</p>
        </div>

        {claim.photoUrl && (
          <div>
            <p className="text-xs text-gray-400 mb-2">Photo envoyée par le client</p>
            <a href={claim.photoUrl} target="_blank" rel="noopener noreferrer">
              <img src={claim.photoUrl} alt="Photo du problème" className="max-h-80 rounded-lg border border-gray-200" />
            </a>
          </div>
        )}

        {claim.status !== 'OPEN' && (
          <div className="mt-4 pt-4 border-t border-gray-100 text-sm text-gray-500">
            Statut : <strong>{claim.status}</strong>
            {claim.creditCode && <> — Code avoir : <strong>{claim.creditCode}</strong> ({Number(claim.creditAmount).toFixed(2)}€)</>}
            {claim.adminNote && <p className="mt-1">Note : {claim.adminNote}</p>}
          </div>
        )}
      </div>

      <ClaimResolutionForm claimId={claim.id} orderTotal={Number(claim.order.total)} status={claim.status} />
    </div>
  );
}
