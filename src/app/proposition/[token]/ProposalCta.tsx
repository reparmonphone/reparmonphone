'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '@/store/cart';
import { markProposalViewed } from './actions';

type Line = { productId: string; slug: string; title: string; price: number; imageUrl: string | null; quantity: number };

export default function ProposalCta({
  token,
  lines,
  hasLabor,
  expired,
}: {
  token: string;
  lines: Line[]; // uniquement les pièces disponibles, au prix actuel
  hasLabor: boolean;
  expired: boolean;
}) {
  const router = useRouter();
  const addItem = useCart((s) => s.addItem);

  useEffect(() => {
    try {
      const k = `rmp_proposal_seen_${token}`;
      if (sessionStorage.getItem(k)) return;
      sessionStorage.setItem(k, '1');
    } catch {
      // stockage indisponible : on compte quand même une consultation
    }
    markProposalViewed(token);
  }, [token]);

  const canOrder = !expired && lines.length > 0;

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      {canOrder && (
        <button
          type="button"
          onClick={() => {
            for (const l of lines) {
              addItem({ productId: l.productId, slug: l.slug, title: l.title, price: l.price, imageUrl: l.imageUrl }, l.quantity);
            }
            router.push('/panier');
          }}
          className="rounded-xl bg-brand px-6 py-3 text-center text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-brand-dark"
        >
          🛒 Ajouter les pièces à mon panier
        </button>
      )}
      {!expired && hasLabor && (
        <Link href="/rdv" className="rounded-xl border border-brand px-6 py-3 text-center text-sm font-bold text-brand transition hover:bg-brand-light">
          📅 Prendre rendez-vous
        </Link>
      )}
    </div>
  );
}
