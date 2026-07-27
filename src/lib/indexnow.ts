// IndexNow : protocole ouvert supporté par Bing, Yandex (Google ne le supporte pas — Google reste basé
// sur le sitemap.xml + exploration classique). Une seule clé suffit pour tous les moteurs participants.
export const INDEXNOW_KEY = process.env.INDEXNOW_KEY ?? '84c3b0b5a3f8e46a71d3c3aaff7772e7';

export async function pingIndexNow(urls: string[]) {
  if (urls.length === 0) return;
  const host = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.reparmonphone.fr').host;

  try {
    await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host,
        key: INDEXNOW_KEY,
        keyLocation: `https://${host}/${INDEXNOW_KEY}.txt`,
        urlList: urls,
      }),
    });
  } catch (e) {
    // Ne bloque jamais une sauvegarde produit pour un souci réseau IndexNow
    console.error('Erreur ping IndexNow', e);
  }
}
