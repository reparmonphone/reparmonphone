type Theme = {
  iconBg: string;
  tileBg: string; // couleur ou dégradé CSS
};

const THEMES: Record<'facebook' | 'instagram', Theme> = {
  facebook: {
    iconBg: '#1877F2',
    tileBg: '#1877F2',
  },
  instagram: {
    iconBg: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)',
    tileBg: 'linear-gradient(180deg, #dc2743, #bc1888)',
  },
};

function FacebookIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 48 48" fill="none">
      <path
        fill="#fff"
        d="M27.5 24.9h4l.6-4.2h-4.6v-2.7c0-1.2.3-2 2.1-2h2.2v-3.8c-.4-.1-1.7-.2-3.2-.2-3.2 0-5.4 2-5.4 5.5v3.2h-3.6v4.2h3.6V35h4.3V24.9z"
      />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="white" stroke="none" />
    </svg>
  );
}

export default function FlipCounter({
  platform,
  count,
}: {
  platform: 'facebook' | 'instagram';
  count: number;
}) {
  const theme = THEMES[platform];
  const digits = String(Math.max(0, Math.round(count))).padStart(6, '0').split('');

  return (
    // Sur mobile, en dessous de la taille "sm" : icône, chiffres et espacements réduits pour que
    // les compteurs Facebook + Instagram tiennent sur une seule ligne côte à côte sans faire
    // déborder la page horizontalement (voir FacebookPageWidget.tsx) — taille d'origine à partir
    // de "sm" où il y a plus de place.
    <div className="flex items-stretch rounded-lg overflow-hidden shadow-sm border border-gray-200 h-10 sm:h-[52px]">
      <div className="flex items-center justify-center w-8 sm:w-12 shrink-0" style={{ background: theme.iconBg }}>
        {platform === 'facebook' ? <FacebookIcon /> : <InstagramIcon />}
      </div>
      <div className="flex gap-[1px] sm:gap-[2px] bg-[#e8ded1] px-[2px] sm:px-[3px] items-center">
        {digits.map((d, i) => (
          <div
            key={i}
            className="relative w-4 h-7 sm:w-6 sm:h-9 rounded-[2px] flex items-center justify-center text-white text-[10px] sm:text-base font-bold overflow-hidden"
            style={{ background: theme.tileBg }}
          >
            {d}
            {/* fine ligne de séparation horizontale, façon volet mécanique */}
            <span className="absolute left-0 right-0 top-1/2 h-px bg-black/25" />
          </div>
        ))}
      </div>
    </div>
  );
}
