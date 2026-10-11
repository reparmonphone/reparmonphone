"use client";

/**
 * KIT « APPLI INSTALLABLE » (PWA) — composant réutilisable pour tous les projets Next.js de Krys.
 *
 * Ce que ça fait :
 *  - Une petite pastille flottante en bas à gauche « Installer l’appli » (discrète, avec une croix pour la masquer 30 jours).
 *  - Au clic : une carte avec icône, titre, phrase, et un gros bouton « Installer l’application »
 *    qui ouvre DIRECTEMENT la vraie fenêtre d’installation du navigateur (Chrome, Edge, Android, Samsung…).
 *  - La pastille n’apparaît QUE si le bouton peut vraiment installer l’appli → jamais de bouton qui ne fait rien.
 *  - Sur iPhone (Apple n’autorise pas l’installation en 1 clic) : le bouton affiche une seule ligne « Touchez Partager puis Sur l’écran d’accueil ».
 *  - Rien ne s’affiche si l’appli est déjà installée.
 *
 * Aucune dépendance : pas besoin de Tailwind, shadcn ou lucide (icônes en SVG, styles intégrés).
 *
 * 👉 SEULE PARTIE À ADAPTER POUR CHAQUE PROJET : l’objet CONFIG juste en dessous.
 */

import { useEffect, useState, type CSSProperties } from "react";
import { usePathname } from "next/navigation";

const CONFIG = {
  /** Nom affiché dans la carte : « Installer <appName> » */
  appName: "ReparMonPhone",
  /** Phrase sous le titre */
  subtitle: "Retrouve nos pièces détachées et ton suivi de commande directement depuis ton écran d’accueil.",
  /** Couleur principale du site (bouton, icône) */
  primaryColor: "#0E7FDB",
  /** Deuxième couleur pour le dégradé de l’icône (mettre la même que primaryColor pour une couleur unie) */
  secondaryColor: "#0B5FA5",
  /** Pages où la pastille ne doit jamais s’afficher */
  hiddenPaths: ["/admin", "/panier", "/checkout", "/compte", "/rdv", "/maintenance"],
  /** Délai avant l’apparition de la pastille (en millisecondes) */
  showDelayMs: 2500,
  /** Nombre de jours pendant lesquels la pastille reste masquée après un clic sur la croix */
  dismissDays: 30,
  /**
   * Si le site a un bandeau cookies qui enregistre le choix dans le localStorage, mettre ici le nom de la clé :
   * la pastille attendra que le visiteur ait fait son choix (pour ne pas empiler deux bandeaux).
   * Laisser "" s’il n’y a pas de bandeau cookies.
   */
  waitForLocalStorageKey: "rmp_cookie_consent",
  /**
   * Distances du bas de l’écran (en pixels). Sur ReparMonPhone, le coin bas-gauche est déjà occupé par le badge
   * « Achats Vérifiés » (≈ 52 px de haut sur téléphone, ≈ 84 px sur ordinateur) : la pastille se place AU-DESSUS.
   */
  barBottomMobile: 80,
  barBottomDesktop: 112,
  mobileCardBottom: 80,
  cardBottomDesktop: 112,
};

// ————————————————————————————————————————————————————————————————————————
// Rien à modifier en dessous.
// ————————————————————————————————————————————————————————————————————————

const DISMISS_KEY = "install-app-dismissed-at";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

declare global {
  interface Window {
    __installPrompt?: InstallPromptEvent | null;
  }
}

/**
 * Petit script à placer TOUT EN HAUT du <body> dans app/layout.tsx.
 * Il capte la fenêtre d’installation de Chrome dès l’ouverture de la page (sinon le bouton peut la rater)
 * et active le service worker /sw.js (obligatoire pour que le site soit installable).
 */
export function InstallAppEarlyScript() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html:
          "window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__installPrompt=e;window.dispatchEvent(new Event('install-app-ready'));});if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(function(){});}",
      }}
    />
  );
}

function safeGet(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function readDismissed() {
  const raw = safeGet(DISMISS_KEY);
  if (!raw) return false;
  const days = (Date.now() - Number(raw)) / 86_400_000;
  return Number.isFinite(days) && days < CONFIG.dismissDays;
}

function saveDismissed() {
  try {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* navigation privée */
  }
}

function isAlreadyInstalled() {
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

function isIos() {
  const ua = window.navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) || (ua.includes("Macintosh") && window.navigator.maxTouchPoints > 1);
}

const gradient = `linear-gradient(135deg, ${CONFIG.primaryColor}, ${CONFIG.secondaryColor})`;
const font = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

function PhoneIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <path d="M12 18h.01" />
    </svg>
  );
}
function DownloadIcon({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m7 10 5 5 5-5" />
      <path d="M12 15V3" />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
function ShareIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={CONFIG.primaryColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <path d="m16 6-4-4-4 4" />
      <path d="M12 2v13" />
    </svg>
  );
}

const closeBtn: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 30,
  height: 30,
  flexShrink: 0,
  border: "none",
  borderRadius: 999,
  background: "transparent",
  color: "#737373",
  cursor: "pointer",
};

export function InstallAppPrompt() {
  const pathname = usePathname() || "/";
  const [view, setView] = useState<"hidden" | "bar" | "card">("hidden");
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const isHiddenPath = CONFIG.hiddenPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const canInstall = installEvent !== null || ios;

  useEffect(() => {
    const sync = () => setInstallEvent(window.__installPrompt ?? null);
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      window.__installPrompt = event as InstallPromptEvent;
      sync();
    };
    const onInstalled = () => {
      window.__installPrompt = null;
      setInstallEvent(null);
      setView("hidden");
      saveDismissed();
    };
    const onResize = () => setIsMobile(window.innerWidth < 640);
    sync();
    onResize();
    window.addEventListener("install-app-ready", sync);
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("install-app-ready", sync);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  useEffect(() => {
    if (isHiddenPath || isAlreadyInstalled() || readDismissed()) {
      setView("hidden");
      return;
    }
    setIos(isIos());
    let timer: ReturnType<typeof setTimeout> | undefined;
    const start = () => {
      if (timer) return;
      if (CONFIG.waitForLocalStorageKey && !safeGet(CONFIG.waitForLocalStorageKey)) return;
      timer = setTimeout(() => setView((v) => (v === "hidden" ? "bar" : v)), CONFIG.showDelayMs);
    };
    start();
    // Si on attend un choix cookies : on revérifie régulièrement (fonctionne avec n’importe quel bandeau).
    const poll = CONFIG.waitForLocalStorageKey ? setInterval(start, 1000) : undefined;
    return () => {
      if (timer) clearTimeout(timer);
      if (poll) clearInterval(poll);
    };
  }, [isHiddenPath]);

  if (view === "hidden" || isHiddenPath || !canInstall) return null;

  const disable = () => {
    saveDismissed();
    setView("hidden");
  };

  const install = async () => {
    if (!installEvent) {
      setShowIosHint(true);
      return;
    }
    try {
      await installEvent.prompt();
      const choice = await installEvent.userChoice.catch(() => null);
      if (choice?.outcome === "accepted") {
        disable();
        return;
      }
    } catch {
      /* fenêtre déjà utilisée */
    }
    // Chrome ne propose la fenêtre qu’une fois par visite : on referme proprement.
    window.__installPrompt = null;
    setInstallEvent(null);
    setView("hidden");
  };

  if (view === "bar") {
    return (
      <div
        role="region"
        aria-label={`Installer l’application ${CONFIG.appName}`}
        style={{
          position: "fixed",
          left: isMobile ? 12 : 24,
          bottom: isMobile ? CONFIG.barBottomMobile : CONFIG.barBottomDesktop,
          zIndex: 40,
          display: "flex",
          alignItems: "center",
          gap: 4,
          maxWidth: "calc(100vw - 104px)",
          padding: 4,
          borderRadius: 999,
          border: `1px solid ${CONFIG.primaryColor}40`,
          background: "rgba(255,255,255,0.96)",
          boxShadow: "0 10px 25px -8px rgba(0,0,0,0.25)",
          fontFamily: font,
        }}
      >
        <button
          type="button"
          onClick={() => {
            setShowIosHint(false);
            setView("card");
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            minWidth: 0,
            padding: "4px 8px 4px 4px",
            border: "none",
            borderRadius: 999,
            background: "transparent",
            cursor: "pointer",
            fontFamily: font,
          }}
        >
          <span
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              flexShrink: 0,
              borderRadius: 999,
              background: gradient,
              color: "#fff",
            }}
          >
            <PhoneIcon size={16} />
          </span>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#171717", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            Installer l’appli{isMobile ? "" : ` ${CONFIG.appName}`}
          </span>
          <DownloadIcon color={CONFIG.primaryColor} />
        </button>
        <button type="button" onClick={disable} aria-label="Masquer ce message" title="Masquer" style={closeBtn}>
          <CloseIcon />
        </button>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-label={`Installer ${CONFIG.appName}`}
      style={{
        position: "fixed",
        left: isMobile ? 12 : 24,
        right: isMobile ? 12 : "auto",
        bottom: isMobile ? CONFIG.mobileCardBottom : CONFIG.cardBottomDesktop,
        zIndex: 40,
        width: isMobile ? "auto" : 380,
        maxWidth: 420,
        margin: isMobile ? "0 auto" : undefined,
        padding: 16,
        borderRadius: 18,
        border: "1px solid #e2e8f0",
        background: "#fff",
        boxShadow: "0 25px 50px -12px rgba(0,0,0,0.3)",
        fontFamily: font,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 48,
            height: 48,
            flexShrink: 0,
            borderRadius: 12,
            background: gradient,
            color: "#fff",
          }}
        >
          <PhoneIcon size={24} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#171717" }}>Installer {CONFIG.appName}</p>
          <p style={{ margin: "2px 0 0", fontSize: 14, lineHeight: 1.35, color: "#737373" }}>{CONFIG.subtitle}</p>
        </div>
        <button type="button" onClick={() => setView("bar")} aria-label="Fermer" style={closeBtn}>
          <CloseIcon />
        </button>
      </div>

      {showIosHint ? (
        <p
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            margin: "16px 0 0",
            padding: 12,
            borderRadius: 12,
            background: "#f1f5f9",
            fontSize: 14,
            color: "#171717",
          }}
        >
          Touchez <ShareIcon /> puis <strong>Sur l’écran d’accueil</strong>
        </p>
      ) : (
        <button
          type="button"
          onClick={() => void install()}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            width: "100%",
            marginTop: 16,
            padding: "12px 16px",
            border: "none",
            borderRadius: 12,
            background: CONFIG.primaryColor,
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: font,
          }}
        >
          <DownloadIcon />
          Installer l’application
        </button>
      )}
      <button
        type="button"
        onClick={disable}
        style={{
          display: "block",
          width: "100%",
          marginTop: 8,
          border: "none",
          background: "transparent",
          color: "#737373",
          fontSize: 12,
          cursor: "pointer",
          fontFamily: font,
        }}
      >
        Ne plus afficher
      </button>
    </div>
  );
}
