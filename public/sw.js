// Service worker minimal (kit appli installable).
// Il rend le site « installable » comme une application. Il ne met rien en cache :
// les pages viennent toujours du site en direct ; seul un petit message s’affiche si le téléphone est hors connexion.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

const OFFLINE_HTML = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hors connexion</title>
<style>body{font-family:system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;background:#E8F3FC;color:#171717;text-align:center;padding:24px}
.c{max-width:360px}.b{display:inline-block;margin-top:16px;padding:12px 20px;border-radius:12px;background:#0E7FDB;color:#fff;text-decoration:none;font-weight:600}</style></head>
<body><div class="c"><h1>Pas de connexion</h1><p>Ce site a besoin d’internet pour fonctionner. Vérifie ta connexion puis réessaie.</p><a class="b" href="/">Réessayer</a></div></body></html>`;

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || request.mode !== "navigate") return;
  event.respondWith(
    fetch(request).catch(
      () => new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } })
    )
  );
});
