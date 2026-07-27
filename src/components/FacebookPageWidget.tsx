import { prisma } from '@/lib/prisma';
import FlipCounter from './FlipCounter';

const FB_PAGE_URL = 'https://www.facebook.com/830284890366434';
// Compte Instagram officiel ReparMonPhone
const INSTAGRAM_URL = 'https://www.instagram.com/repar_mon_phone/';

export default async function FacebookPageWidget() {
  const settings = await prisma.siteSetting.findMany({
    where: { key: { in: ['facebook_followers_count', 'instagram_followers_count'] } },
  });
  const getCount = (key: string) => Number(settings.find((s) => s.key === key)?.value ?? 0);

  return (
    <div className="bg-white border-b border-gray-100 py-3">
      <div className="max-w-6xl mx-auto px-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Compteurs à volets façon Smiirl — nombre d'abonnés géré dans /admin/partenaires */}
          <FlipCounter platform="facebook" count={getCount('facebook_followers_count')} />
          <FlipCounter platform="instagram" count={getCount('instagram_followers_count')} />
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <a
            href={FB_PAGE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-[#1877F2] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[#0f5fcc] transition"
          >
            👍 Suivre la page
          </a>
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-white text-sm font-semibold px-4 py-2 rounded-lg transition hover:opacity-90"
            style={{ background: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)' }}
          >
            📷 Follow me Instagram
          </a>
        </div>
      </div>
    </div>
  );
}
