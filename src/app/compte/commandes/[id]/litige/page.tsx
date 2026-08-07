import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';
import ClaimForm from './ClaimForm';

export default async function SignalerProblemePage({ params }: { params: { id: string } }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/compte/connexion');

  const order = await prisma.order.findUnique({ where: { id: params.id } });
  if (!order) notFound();
  if (order.userId !== user.id && order.customerEmail !== user.email) notFound();

  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      <Link href="/compte/commandes" className="text-sm text-gray-400 hover:text-brand">← Retour à mes commandes</Link>
      <h1 className="text-2xl font-bold mt-2 mb-1">Signaler un problème</h1>
      <p className="text-gray-500 mb-6">Commande #{order.invoiceNumber || order.id.slice(-8)}</p>

      <ClaimForm orderId={order.id} />
    </div>
  );
}
