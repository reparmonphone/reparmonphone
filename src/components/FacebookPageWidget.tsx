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
      <div className="max-w-6xl mx-auto px-4">
        {/* Compteur Facebook + compteur Instagram côte à côte, y compris sur mobile — FlipCounter a
            une taille réduite en dessous de "sm" (voir FlipCounter.tsx) spécialement pour que les
            deux tiennent sur une seule ligne sans faire déborder la page horizontalement (ce qui
            poussait auparavant la bulle "Besoin d'aide" hors écran en bas à droite). */}
        <div className="grid grid-cols-2 gap-2 max-w-md mx-auto sm:max-w-none sm:flex sm:items-start sm:justify-center sm:gap-8">
          {/* Colonne Facebook : compteur + bouton juste en dessous, alignés */}
          <div className="flex flex-col items-center gap-2">
            <FlipCounter platform="facebook" count={getCount('facebook_followers_count')} />
            <a
              href={FB_PAGE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-[#1877F2] text-white text-xs sm:text-sm font-semibold px-3 sm:px-4 py-2 rounded-lg hover:bg-[#0f5fcc] transition w-full sm:w-auto"
            >
              👍 Suivre la page
            </a>
          </div>

          {/* Colonne Instagram : compteur + bouton juste en dessous, alignés */}
          <div className="flex flex-col items-center gap-2">
            <FlipCounter platform="instagram" count={getCount('instagram_followers_count')} />
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 text-white text-xs sm:text-sm font-semibold px-3 sm:px-4 py-2 rounded-lg transition hover:opacity-90 w-full sm:w-auto"
              style={{ background: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)' }}
            >
              📷 Follow me Instagram
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
