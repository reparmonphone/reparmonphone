import Link from 'next/link';

export default function TopUtilityBar() {
  return (
    <div className="bg-gray-900 text-gray-300 text-xs">
      <div className="max-w-6xl mx-auto px-4 h-9 flex items-center justify-between gap-4">
        <div className="hidden sm:flex items-center gap-4">
          <a href="tel:+33783497262" className="hover:text-white">📞 (+33) 07.83.49.72.62</a>
          <span className="hidden md:inline text-gray-600">|</span>
          <span className="hidden md:inline">📍 Les Saquèdes, 83120 Sainte-Maxime — France</span>
        </div>

        <div className="flex items-center gap-4 ml-auto">
          <span className="hidden sm:inline text-brand-light">
            🎁 Bénéficiez de 15% sur votre 2ème commande !{' '}
            <Link href="/boutique" className="underline font-medium">En savoir plus</Link>
          </span>
          <div className="flex items-center gap-2 text-sm">
            <a href="https://www.facebook.com/830284890366434" target="_blank" rel="noopener noreferrer" aria-label="Facebook" suppressHydrationWarning>📘</a>
            <a href="https://www.instagram.com/repar_mon_phone/" target="_blank" rel="noopener noreferrer" aria-label="Instagram" suppressHydrationWarning>📷</a>
          </div>
        </div>
      </div>
    </div>
  );
}
