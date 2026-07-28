import { prisma } from '@/lib/prisma';
import { INDEXNOW_KEY } from '@/lib/indexnow';
import SeoVerificationForm from './SeoVerificationForm';
import RedirectsManager from './RedirectsManager';
import IndexNowPanel from './IndexNowPanel';

export default async function AdminSeoPage() {
  const [settings, redirects, productsCount] = await Promise.all([
    prisma.siteSetting.findMany({ where: { key: { in: ['seo_google_verification', 'seo_bing_verification'] } } }),
    prisma.redirect.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.product.count({ where: { showInBoutique: true } }),
  ]);

  const getSetting = (key: string) => settings.find((s) => s.key === key)?.value ?? '';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.reparmonphone.fr';

  return (
    <div className="max-w-4xl space-y-10">
      <div>
        <h1 className="text-2xl font-bold mb-1">SEO & Référencement</h1>
        <p className="text-gray-500">
          Tout ce qui est déjà en place automatiquement (sitemap, données structurées, IndexNow...), et ce qu'il
          te reste à faire toi-même sur Google Search Console et Bing Webmaster Tools.
        </p>
      </div>

      {/* Déjà fait automatiquement */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-5">
        <h2 className="font-semibold text-green-800 mb-3">✅ Déjà en place automatiquement</h2>
        <ul className="text-sm text-green-800 space-y-1.5">
          <li>• <strong>Sitemap XML</strong> généré automatiquement (produits, marques, collections, pages) : <a href="/sitemap.xml" target="_blank" className="underline">{siteUrl}/sitemap.xml</a></li>
          <li>• <strong>robots.txt</strong> : <a href="/robots.txt" target="_blank" className="underline">{siteUrl}/robots.txt</a></li>
          <li>• <strong>Données structurées (JSON-LD)</strong> : fiche établissement (LocalBusiness), fiches produits avec prix/stock/note moyenne, fil d'ariane</li>
          <li>• <strong>llms.txt</strong> (optimisation GEO pour ChatGPT/Perplexity/IA) : <a href="/llms.txt" target="_blank" className="underline">{siteUrl}/llms.txt</a></li>
          <li>• <strong>IndexNow</strong> : Bing/Yandex notifiés automatiquement à chaque produit créé/modifié</li>
          <li>• Meta titre/description personnalisables par produit (déjà en place depuis plus tôt)</li>
        </ul>
      </div>

      {/* Vérification Google/Bing */}
      <div>
        <h2 className="text-lg font-bold mb-3">1. Vérification Google Search Console & Bing Webmaster Tools</h2>
        <p className="text-gray-500 text-sm mb-4">
          Colle ici le code de vérification fourni par chaque outil (méthode "balise HTML") — pas besoin de
          toucher au code, le site l'ajoutera automatiquement dans le <code className="bg-gray-100 px-1 rounded">&lt;head&gt;</code>.
        </p>
        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <SeoVerificationForm
            initialGoogle={getSetting('seo_google_verification')}
            initialBing={getSetting('seo_bing_verification')}
          />
        </div>
        <ol className="text-sm text-gray-500 mt-3 space-y-1 list-decimal list-inside">
          <li><a href="https://search.google.com/search-console" target="_blank" className="text-brand hover:underline">Google Search Console</a> → Ajouter une propriété → méthode "Balise HTML" → copie juste le contenu de l'attribut <code className="bg-gray-100 px-1 rounded">content="..."</code></li>
          <li><a href="https://www.bing.com/webmasters" target="_blank" className="text-brand hover:underline">Bing Webmaster Tools</a> → même principe (ou importe directement depuis Google Search Console, Bing le propose)</li>
          <li>Une fois le code collé ici et le site redéployé, clique sur "Vérifier" côté Google/Bing</li>
          <li>Soumets ensuite le sitemap : <code className="bg-gray-100 px-1 rounded">{siteUrl}/sitemap.xml</code></li>
        </ol>
      </div>

      {/* IndexNow */}
      <div>
        <h2 className="text-lg font-bold mb-3">2. IndexNow (Bing & Yandex)</h2>
        <p className="text-gray-500 text-sm mb-4">
          Contrairement à Google, Bing et Yandex supportent IndexNow : dès qu'un produit est créé ou modifié, ce
          site les notifie automatiquement (pas d'action de ta part). Le bouton ci-dessous permet de tout
          re-soumettre en une fois (utile juste après la mise en ligne, ou après un gros import).
        </p>
        <IndexNowPanel indexNowKey={INDEXNOW_KEY} productsCount={productsCount} />
      </div>

      {/* Redirections */}
      <div>
        <h2 className="text-lg font-bold mb-3">3. Redirections 301 (anciennes URLs)</h2>
        <p className="text-gray-500 text-sm mb-4">
          <strong>Important après la migration depuis l'ancien site WooCommerce</strong> : si une ancienne URL
          n'a pas d'équivalent direct sur le nouveau site, Google Search Console (rubrique "Pages" → "Non
          indexée" → erreurs 404) te le signalera dans les prochaines semaines. Ajoute la redirection ici dès
          que tu en repères une — inutile de tout anticiper, ce sera plus fiable de corriger au fur et à mesure
          des vraies erreurs remontées par Google.
        </p>
        <RedirectsManager redirects={redirects.map((r) => ({ id: r.id, fromPath: r.fromPath, toPath: r.toPath, statusCode: r.statusCode, hits: r.hits }))} />
      </div>
    </div>
  );
}
