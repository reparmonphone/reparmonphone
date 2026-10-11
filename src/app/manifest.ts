import type { MetadataRoute } from "next";

// Fiche « application » du site : c’est elle qui rend le site installable
// (nom, couleurs et icône affichés dans la fenêtre « Installer l’appli » et sur l’écran d’accueil).
// 👉 À ADAPTER : name, short_name, description, theme_color, et les icônes dans /public.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "ReparMonPhone – Pièces détachées et réparation smartphone",
    short_name: "ReparMonPhone",
    description: "Pièces détachées et réparation de smartphones et tablettes, livraison Chronopost 24h partout en France.",
    lang: "fr",
    start_url: "/?source=app",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0E7FDB",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
