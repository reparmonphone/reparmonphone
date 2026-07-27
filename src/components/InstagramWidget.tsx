import Image from 'next/image';
import { prisma } from '@/lib/prisma';

const INSTAGRAM_URL = 'https://www.instagram.com/repar_mon_phone/';

export default async function InstagramWidget() {
  let followers = '—';
  try {
    const setting = await prisma.siteSetting.findUnique({ where: { key: 'instagram_followers' } });
    followers = setting?.value ?? '—';
  } catch {
    // Réglage pas encore en base — pas bloquant, on affiche juste sans le chiffre
  }

  return (
    <a
      href={INSTAGRAM_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 border border-gray-200 rounded-lg p-2 hover:bg-gray-50 transition"
    >
      <div className="relative w-12 h-12 shrink-0 rounded overflow-hidden border border-gray-100">
        <Image
          src="https://www.reparmonphone.fr/wp-content/uploads/2025/03/logo-repar-mon-phone-3.png"
          alt="ReparMonPhone sur Instagram"
          fill
          className="object-cover"
        />
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-800">Repar Mon Phone</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span
            className="text-white text-xs font-semibold px-2.5 py-1 rounded"
            style={{ background: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)' }}
          >
            📷 Suivre
          </span>
          {followers !== '—' && <span className="text-xs text-gray-500">{followers} followers</span>}
        </div>
      </div>
    </a>
  );
}
