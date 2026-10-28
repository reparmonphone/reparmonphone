import type { Metadata } from 'next';
import Link from 'next/link';
import { getTicketCode, loadScratchLog, markClicked, resolvePromo, verifyUnsubToken } from '@/lib/marketing';
import { normalizeEmail } from '@/lib/bannedClients';
import ScratchCard from './ScratchCard';

export const metadata: Metadata = {
  title: 'Ton ticket à gratter',
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';

export default async function TicketPage({ searchParams }: { searchParams: { e?: string; t?: string } }) {
  const email = (searchParams.e ?? '').trim();
  const token = searchParams.t ?? '';
  const valid = !!email && verifyUnsubToken(email, token, 'ticket');

  let promo: { code: string; label: string; conditions: string[] } | null = null;
  let already = false;
  if (valid) {
    // Il a cliqué dans l'e-mail : indicateur « a cliqué » dans l'admin (sans bloquer la page en cas de souci)
    try {
      await markClicked(email);
    } catch {
      // ignoré
    }
    const code = await getTicketCode();
    if (code) {
      const r = await resolvePromo(code);
      if (!('error' in r) && r.promo) promo = r.promo;
    }
    const log = await loadScratchLog();
    already = !!log[normalizeEmail(email)];
  }

  return (
    <div className="min-h-[70vh] bg-[#0b1b33] px-4 py-12">
      <div className="max-w-md mx-auto text-center">
        {valid && promo ? (
          <>
            <p className="text-xs tracking-[0.2em] uppercase text-[#7fb5ff] font-bold mb-2">ReparMonPhone</p>
            <h1 className="text-3xl font-extrabold text-white mb-2">Ton ticket à gratter 🎟️</h1>
            <p className="text-[#c9d8ef] mb-6">
              Chaque ticket est gagnant. Gratte la zone argentée avec ton doigt ou ta souris pour découvrir ton cadeau.
            </p>
            <ScratchCard code={promo.code} label={promo.label} conditions={promo.conditions} email={email} token={token} alreadyScratched={already} />
          </>
        ) : (
          <div className="bg-white rounded-xl p-8">
            <h1 className="text-xl font-bold mb-2">Ce ticket n’est plus disponible</h1>
            <p className="text-gray-600 text-sm mb-5">
              {valid ? 'L’offre est terminée ou expirée.' : 'Le lien est incomplet ou invalide : ouvre-le directement depuis l’e-mail que tu as reçu.'}
            </p>
            <Link href="/boutique" className="text-brand font-medium hover:underline">
              Voir les pièces détachées
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
