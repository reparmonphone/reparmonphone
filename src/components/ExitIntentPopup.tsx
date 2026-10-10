'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCart } from '@/store/cart';
import { formatPrice } from '@/lib/format';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import { getStoredConsent } from '@/lib/cookieConsent';

// Popup de sortie : remercie le visiteur qui s'apprête à quitter le site et le rassure pour l'inciter
// à finaliser sa commande (ou à demander de l'aide s'il n'a pas trouvé sa pièce). Aucune remise.
//
// Règles pour rester respectueux (et ne pas pénaliser le référencement Google, qui n'aime pas les
// popups intrusifs, surtout sur mobile) :
//  - jamais avant que le visiteur ait répondu à la bannière cookies ;
//  - une seule fois par session, puis pas avant 7 jours ;
//  - jamais sur /admin, /checkout (confirmation de paiement), /compte, /rdv, /maintenance ;
//  - ordinateur : déclenché quand la souris sort par le haut de la fenêtre (intention de quitter),
//    après au moins 10 s passées sur le site ;
//  - mobile/tablette (pas de détection de sortie possible) : uniquement si le panier n'est pas vide,
//    après 45 s d'inactivité ;
//  - se ferme avec la croix, « Non merci », la touche Échap ou un clic en dehors.

const SESSION_KEY = 'rmp_exit_popup_session';
const SEEN_KEY = 'rmp_exit_popup_seen_at';
const COOLDOWN_DAYS = 7;
const MIN_TIME_ON_SITE_MS = 10_000;
const MOBILE_IDLE_MS = 45_000;
const EXCLUDED_PREFIXES = ['/admin', '/checkout', '/compte', '/rdv', '/maintenance'];

const PHONE_DISPLAY = '07 83 49 72 62';
const PHONE_TEL = '+33783497262';

type Snapshot = {
  cartCount: number;
  cartTotal: number;
  firstTitle: string | null;
  loggedIn: boolean | null; // null = on ne sait pas (erreur de lecture de session)
};

function alreadySeen(): boolean {
  try {
    if (sessionStorage.getItem(SESSION_KEY)) return true;
    const raw = localStorage.getItem(SEEN_KEY);
    if (raw) {
      const at = Number(raw);
      if (Number.isFinite(at) && Date.now() - at < COOLDOWN_DAYS * 24 * 60 * 60 * 1000) return true;
    }
  } catch {
    // stockage indisponible (navigation privée stricte...) : on se rabat sur "une fois par chargement de page"
  }
  return false;
}

function markSeen() {
  try {
    sessionStorage.setItem(SESSION_KEY, '1');
    localStorage.setItem(SEEN_KEY, String(Date.now()));
  } catch {
    // idem : pas bloquant
  }
}

// Même mécanique que les événements e-commerce (lib/gtmEvents.ts) : on pousse dans le dataLayer,
// GTM ne traite l'événement qu'après consentement "statistiques".
function pushEvent(event: string, params: Record<string, unknown> = {}) {
  if (typeof window === 'undefined') return;
  const w = window as unknown as { dataLayer?: unknown[] };
  w.dataLayer = w.dataLayer || [];
  w.dataLayer.push({ event, ...params });
}

export default function ExitIntentPopup() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  const startedAt = useRef(Date.now());
  const triggered = useRef(false);
  const lastFocus = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const excluded = !pathname || EXCLUDED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  // Change de page (ex : clic sur un bouton du popup) : on le ferme.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Déclencheurs
  useEffect(() => {
    if (excluded) return;

    let cancelled = false;
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    async function tryShow(needCart: boolean): Promise<boolean> {
      if (cancelled || triggered.current) return false;
      if (document.visibilityState !== 'visible') return false;
      if (!getStoredConsent() || alreadySeen()) return false;

      const { items } = useCart.getState();
      const cartCount = items.reduce((s, i) => s + i.quantity, 0);
      if (needCart && cartCount === 0) return false;

      triggered.current = true;

      let loggedIn: boolean | null = null;
      if (cartCount > 0) {
        try {
          const { data } = await createSupabaseBrowserClient().auth.getSession();
          loggedIn = !!data.session;
        } catch {
          loggedIn = null;
        }
      }
      if (cancelled) {
        triggered.current = false;
        return false;
      }

      markSeen();
      setSnapshot({
        cartCount,
        cartTotal: items.reduce((s, i) => s + i.price * i.quantity, 0),
        firstTitle: items[0]?.title ?? null,
        loggedIn,
      });
      lastFocus.current = document.activeElement as HTMLElement | null;
      setOpen(true);
      pushEvent('exit_popup_shown', { variant: cartCount > 0 ? 'cart' : 'no_cart' });
      return true;
    }

    // Ordinateur : la souris quitte la fenêtre par le haut (barre d'onglets / adresse)
    function onMouseOut(e: MouseEvent) {
      if (e.relatedTarget || e.clientY > 0) return;
      if (Date.now() - startedAt.current < MIN_TIME_ON_SITE_MS) return;
      void tryShow(false);
    }

    // Mobile / tablette : inactivité prolongée avec un panier non vide
    function armIdle() {
      if (cancelled || triggered.current) return;
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(async () => {
        const shown = await tryShow(true);
        if (!shown) armIdle();
      }, MOBILE_IDLE_MS);
    }
    const idleEvents = ['touchstart', 'scroll', 'click', 'keydown'] as const;

    if (canHover) {
      document.addEventListener('mouseout', onMouseOut);
    } else {
      idleEvents.forEach((ev) => window.addEventListener(ev, armIdle, { passive: true }));
      armIdle();
    }

    return () => {
      cancelled = true;
      if (idleTimer) clearTimeout(idleTimer);
      document.removeEventListener('mouseout', onMouseOut);
      idleEvents.forEach((ev) => window.removeEventListener(ev, armIdle));
    };
  }, [excluded]);

  // Accessibilité : focus sur la croix à l'ouverture, Échap pour fermer, Tab reste dans le popup
  useEffect(() => {
    if (!open) return;
    closeBtnRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function close() {
    setOpen(false);
    pushEvent('exit_popup_closed');
    lastFocus.current?.focus?.();
  }

  function clickCta(cta: string) {
    pushEvent('exit_popup_cta_click', { cta });
    setOpen(false);
  }

  if (!open || !snapshot) return null;

  const hasCart = snapshot.cartCount > 0;
  const onCartPage = pathname === '/panier';
  const otherItems = snapshot.cartCount - 1;

  return (
    <div
      className="fixed inset-0 z-[65] bg-black/50 flex items-end sm:items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="exit-popup-title"
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
      >
        <button
          ref={closeBtnRef}
          type="button"
          onClick={close}
          aria-label="Fermer"
          className="absolute top-2 right-2 w-10 h-10 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 text-2xl leading-none"
        >
          ×
        </button>

        <div className="px-6 pt-8 pb-6">
          {hasCart ? (
            <>
              <h2 id="exit-popup-title" className="text-xl font-bold text-gray-900 pr-6">
                Merci de ta visite, ton panier est sauvegardé 🛒
              </h2>
              <p className="text-sm text-gray-600 mt-2">
                Tu n&apos;as plus qu&apos;à finaliser quand tu es prêt.
              </p>

              <div className="mt-4 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm">
                {snapshot.firstTitle && (
                  <p className="font-medium text-gray-800 line-clamp-2">
                    {snapshot.firstTitle}
                    {otherItems > 0 && (
                      <span className="text-gray-500 font-normal">
                        {' '}
                        et {otherItems} autre{otherItems > 1 ? 's' : ''} article{otherItems > 1 ? 's' : ''}
                      </span>
                    )}
                  </p>
                )}
                <p className="text-brand-dark font-semibold mt-1">
                  {snapshot.cartCount} article{snapshot.cartCount > 1 ? 's' : ''} — {formatPrice(snapshot.cartTotal)}
                </p>
              </div>

              <ul className="mt-4 space-y-2 text-sm text-gray-700">
                <li>✅ Paiement 100 % sécurisé, tes données bancaires ne sont jamais stockées chez nous</li>
                <li>🚚 Expédition Chronopost 24h partout en France</li>
                <li>🇫🇷 SAV en France, équipe à Sainte-Maxime</li>
                <li>
                  📞 Une question avant de commander ?{' '}
                  <a href={`tel:${PHONE_TEL}`} className="text-brand font-medium hover:underline whitespace-nowrap">
                    {PHONE_DISPLAY}
                  </a>{' '}
                  (lun–sam, 9h–18h)
                </li>
              </ul>

              {snapshot.loggedIn === false && (
                <p className="mt-4 text-xs text-gray-600 bg-brand-light border border-brand/20 rounded-lg px-3 py-2">
                  Un compte gratuit se crée en moins d&apos;une minute : il te permet de suivre ta commande et de
                  retrouver tes factures. Ton panier est conservé.
                </p>
              )}

              <div className="mt-5 space-y-2">
                {snapshot.loggedIn === false ? (
                  <>
                    <Link
                      href="/compte/inscription?redirect=/panier"
                      onClick={() => clickCta('create_account')}
                      className="block w-full text-center bg-brand text-white py-3 rounded-lg font-semibold hover:bg-brand-dark transition"
                    >
                      Créer mon compte et finaliser
                    </Link>
                    <Link
                      href="/compte/connexion?redirect=/panier"
                      onClick={() => clickCta('login')}
                      className="block w-full text-center border border-gray-200 text-gray-700 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-50 transition"
                    >
                      J&apos;ai déjà un compte
                    </Link>
                  </>
                ) : onCartPage ? (
                  <button
                    type="button"
                    onClick={() => clickCta('resume_order')}
                    className="block w-full text-center bg-brand text-white py-3 rounded-lg font-semibold hover:bg-brand-dark transition"
                  >
                    Reprendre ma commande
                  </button>
                ) : (
                  <Link
                    href="/panier"
                    onClick={() => clickCta('finish_order')}
                    className="block w-full text-center bg-brand text-white py-3 rounded-lg font-semibold hover:bg-brand-dark transition"
                  >
                    Finaliser ma commande
                  </Link>
                )}
              </div>
            </>
          ) : (
            <>
              <h2 id="exit-popup-title" className="text-xl font-bold text-gray-900 pr-6">
                Merci d&apos;être passé nous voir !
              </h2>
              <p className="text-sm text-gray-600 mt-2">
                Tu n&apos;as pas trouvé la pièce qu&apos;il te faut ? Dis-nous ce que tu cherches, on t&apos;aide
                volontiers à trouver la bonne référence pour ton téléphone ou ta tablette.
              </p>

              <ul className="mt-4 space-y-2 text-sm text-gray-700">
                <li>📱 Pièces pour Apple, Samsung, Huawei, Xiaomi et d&apos;autres sur demande</li>
                <li>🚚 Expédition Chronopost 24h partout en France</li>
                <li>✅ Paiement 100 % sécurisé</li>
                <li>🇫🇷 SAV en France, équipe à Sainte-Maxime</li>
              </ul>

              <div className="mt-5 space-y-2">
                <Link
                  href="/boutique"
                  onClick={() => clickCta('browse_shop')}
                  className="block w-full text-center bg-brand text-white py-3 rounded-lg font-semibold hover:bg-brand-dark transition"
                >
                  Chercher ma pièce
                </Link>
                <Link
                  href="/contact"
                  onClick={() => clickCta('contact')}
                  className="block w-full text-center border border-gray-200 text-gray-700 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-50 transition"
                >
                  Poser une question
                </Link>
                <p className="text-center text-xs text-gray-500">
                  ou appelle-nous :{' '}
                  <a href={`tel:${PHONE_TEL}`} className="text-brand font-medium hover:underline whitespace-nowrap">
                    {PHONE_DISPLAY}
                  </a>{' '}
                  (lun–sam, 9h–18h)
                </p>
              </div>
            </>
          )}

          <button
            type="button"
            onClick={close}
            className="block mx-auto mt-4 text-xs text-gray-500 hover:text-gray-700 hover:underline"
          >
            Non merci, je continue plus tard
          </button>
        </div>
      </div>
    </div>
  );
}
