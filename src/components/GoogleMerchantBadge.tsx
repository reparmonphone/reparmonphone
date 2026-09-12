'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';

// Badge "note Google" (widget officiel Merchant Center) — affiché sur toutes les pages du site
// (les visiteurs n'arrivent pas forcément par l'accueil), mais UNIQUEMENT sur desktop : sur mobile,
// les deux coins bas de l'écran sont déjà occupés par le badge "Achats Vérifiés" (gauche) et la bulle
// "Besoin d'aide ?" (droite) — voir VerifiedReviewsFloatingBadge.tsx et HelpWidget.tsx. Ajouter un 3e
// élément flottant y aurait surchargé l'écran, donc on ne charge même pas le script sur mobile.
// Sur desktop, le badge est décalé vers le haut (bottomMargin) pour ne pas chevaucher la bulle d'aide.
const GOOGLE_MERCHANT_ID = 5610235067;

export default function GoogleMerchantBadge() {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    setIsDesktop(mq.matches);
    const listener = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', listener);
    return () => mq.removeEventListener('change', listener);
  }, []);

  if (!isDesktop) return null;

  return (
    <>
      <Script id="merchantWidgetScript" src="https://www.gstatic.com/shopping/merchant/merchantwidget.js" strategy="afterInteractive" />
      <Script id="merchant-widget-start" strategy="afterInteractive">
        {`
          document.getElementById('merchantWidgetScript').addEventListener('load', function () {
            merchantwidget.start({
              merchant_id: ${GOOGLE_MERCHANT_ID},
              position: 'RIGHT_BOTTOM',
              bottomMargin: 100
            });
          });
        `}
      </Script>
    </>
  );
}
