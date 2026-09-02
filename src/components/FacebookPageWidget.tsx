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
        {/* Compteur Facebook + compteur Instagram (FlipCounter, ~208px de large chacun, largeur fixe
            non compressible) : sur mobile ils sont empilés (1 colonne, ~220px de large) plutôt que
            côte à côte, sinon les deux ensemble (~430px+) dépassent la largeur de l'écran et font
            défiler toute la page horizontalement — ce qui poussait la bulle "Besoin d'aide" hors
            écran en bas à droite. Côte à côte à nouveau à partir de "sm" (plus de place). */}
        <div className="grid grid-cols-1 gap-3 max-w-[220px] mx-auto sm:max-w-none sm:flex sm:items-start sm:justify-center sm:gap-8">
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
