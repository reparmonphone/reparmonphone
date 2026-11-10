import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { requireAdminUser } from '@/lib/supabase-server';
import { closeOrderPayment } from '@/lib/pendingPayments';

export const dynamic = 'force-dynamic';

// Pages de paiement Stripe encore OUVERTES dont la commande n'existe plus (commande en attente supprimée dans l'admin).
// Sans ça, le client peut encore payer pendant 24 h. À ouvrir dans le navigateur, connecté en admin :
//   /api/admin/stripe-orphans          → liste seulement (rien n'est modifié)
//   /api/admin/stripe-orphans?run=1    → ferme ces pages de paiement
export async function GET(req: NextRequest) {
  try {
    await requireAdminUser();
  } catch {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  const run = req.nextUrl.searchParams.get('run') === '1';
  const open = await stripe.checkout.sessions.list({ status: 'open', limit: 100 });
  const orphans: { session: string; montant: string; email: string | null; creee: string; fermee: boolean }[] = [];
  for (const s of open.data) {
    const orderId = s.metadata?.orderId;
    if (!orderId) continue; // autre type de paiement (ex. réparation par correspondance) : on n'y touche pas
    const exists = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true } });
    if (exists) continue;
    let closed = false;
    if (run) {
      try {
        await stripe.checkout.sessions.expire(s.id);
        closed = true;
      } catch {
        closed = false;
      }
    }
    orphans.push({
      session: s.id,
      montant: `${((s.amount_total ?? 0) / 100).toFixed(2)} €`,
      email: s.customer_details?.email ?? s.customer_email ?? null,
      creee: new Date(s.created * 1000).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }),
      fermee: closed,
    });
  }
  // Commandes EN ATTENTE dont un produit est maintenant en rupture : leur page de paiement (Stripe / SumUp) doit être fermée,
  // sinon le client peut encore payer en rejouant sa carte sur la même page.
  const pending = (await prisma.order.findMany({
    where: { status: 'PENDING', items: { some: { product: { inStock: false } } } },
    select: {
      id: true,
      customerEmail: true,
      customerName: true,
      stripeSessionId: true,
      sumupCheckoutId: true,
      paymentProvider: true,
      items: { select: { product: { select: { title: true, inStock: true } } } },
    },
  })) as {
    id: string;
    customerEmail: string;
    customerName: string;
    stripeSessionId: string | null;
    sumupCheckoutId: string | null;
    paymentProvider: string;
    items: { product: { title: string; inStock: boolean } }[];
  }[];
  const enRupture: { commande: string; client: string; moyen: string; produitsEnRupture: string[]; pageDePaiementFermee: boolean }[] = [];
  for (const o of pending) {
    let closed = false;
    if (run) closed = await closeOrderPayment(o);
    enRupture.push({
      commande: o.id,
      client: `${o.customerName} <${o.customerEmail}>`,
      moyen: o.paymentProvider,
      produitsEnRupture: o.items.filter((i) => !i.product.inStock).map((i) => i.product.title),
      pageDePaiementFermee: closed,
    });
  }

  return NextResponse.json({
    mode: run ? 'fermeture effectuée' : 'liste seulement (ajoute ?run=1 pour fermer)',
    pagesDePaiementOrphelines: orphans.length,
    orphans,
    commandesEnAttenteAvecProduitEnRupture: enRupture.length,
    enRupture,
    note: 'PayPal : une commande PayPal déjà ouverte ne peut pas être fermée par le site (mais le panier, lui, est refusé).',
  });
}
