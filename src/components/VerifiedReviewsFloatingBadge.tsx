import Link from 'next/link';
import { prisma } from '@/lib/prisma';

export default async function VerifiedReviewsFloatingBadge() {
  const agg = await prisma.productReview.aggregate({
    where: { verified: true },
    _avg: { rating: true },
    _count: { rating: true },
  });

  const count = agg._count.rating;
  const average = agg._avg.rating;

  // Rien à afficher tant qu'aucun avis vérifié n'a encore été laissé (le badge ne veut rien dire à 0 avis)
  if (!count || !average) return null;

  const rounded = Math.round(average);

  return (
    <Link
      href="/avis-verifies"
      suppressHydrationWarning
      className="fixed left-4 bottom-4 z-50 flex items-center gap-3 bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 hover:shadow-xl transition"
    >
      <div className="relative w-9 h-9 shrink-0">
        <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
          <path d="M12 2L4 5v6c0 5.5 3.4 10.2 8 11.5 4.6-1.3 8-6 8-11.5V5l-8-3z" fill="#22c55e" />
          <path d="M9 12.5l2 2 4-4.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="leading-tight">
        <p className="text-[11px] font-bold text-gray-800 uppercase tracking-wide">Avis Vérifiés</p>
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold text-gray-900">{average.toFixed(1)}</span>
          <span className="text-amber-400 text-xs">
            {'★'.repeat(rounded)}
            <span className="text-gray-200">{'★'.repeat(5 - rounded)}</span>
          </span>
        </div>
        <p className="text-[10px] text-gray-400">{count} avis vérifié{count > 1 ? 's' : ''}</p>
      </div>
    </Link>
  );
}
