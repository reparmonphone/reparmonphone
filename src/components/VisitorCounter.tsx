import { prisma } from '@/lib/prisma';

const VISIT_COUNTER_OFFSET = 21120;

export default async function VisitorCounter() {
  let total = VISIT_COUNTER_OFFSET;
  try {
    const count = await prisma.pageView.count();
    total += count;
  } catch {
    // si la table n'existe pas encore (avant db:push), on affiche juste le chiffre de départ
  }

  const digits = String(total).padStart(6, '0').split('');

  return (
    <div className="flex flex-col items-center py-6">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">👀 Visiteurs du site</p>
      <div className="flex gap-[3px] bg-[#1f2937] p-2 rounded-lg shadow-inner">
        {digits.map((d, i) => (
          <div
            key={i}
            className="relative w-8 h-11 rounded-[3px] bg-gradient-to-b from-gray-700 to-gray-900 flex items-center justify-center text-white text-xl font-bold font-mono overflow-hidden border border-black/30"
          >
            {d}
            <span className="absolute left-0 right-0 top-1/2 h-px bg-black/40" />
          </div>
        ))}
      </div>
    </div>
  );
}
