import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Route publique (pas d'auth) : flux produits au format Google Shopping (RSS + espace de noms g:),
// à enregistrer dans Merchant Center → Paramètres → Sources de données → "Ajouter une source de
// produits" → Récupération programmée, avec cette URL. Remplace l'auto-découverte ("Trouvé par
// Google") par un vrai flux, plus fiable et plus complet (stock, prix barré, marque...).
export const dynamic = 'force-dynamic';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.reparmonphone.fr';

// Catégorie Google appliquée à tous les produits : "Mobile Phone Replacement Parts" (ID 7347,
// taxonomie Google officielle). Correcte pour l'immense majorité du catalogue (écrans, batteries,
// nappes, connecteurs...) ; quelques articles (outillage, accessoires) sont un peu moins bien
// catégorisés avec cet ID unique appliqué partout, mais ce n'est pas bloquant — Google tolère ce
// genre d'écart, et une catégorisation fine par pieceType serait beaucoup de travail pour peu de gain.
const GOOGLE_PRODUCT_CATEGORY = '7347';

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// La description produit est stockée en HTML — Google veut du texte brut.
function stripHtml(html: string) {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// condition (French, libre) -> valeur attendue par Google (new / refurbished / used)
function mapCondition(condition: string | null) {
  const c = (condition ?? '').toLowerCase();
  if (c.includes('occasion')) return 'used';
  if (c.includes('reconditionn')) return 'refurbished';
  return 'new';
}

export async function GET() {
  const products = await prisma.product.findMany({
    where: { showInBoutique: true, imageUrl: { not: null } },
    include: { model: { include: { productLine: { include: { brand: true } } } } },
    orderBy: { title: 'asc' },
  });

  const items = products
    .map((p) => {
      if (!p.imageUrl) return null; // sécurité supplémentaire — g:image_link est obligatoire

      const link = `${SITE_URL}/produit/${p.slug}`;
      const title = p.title.trim().slice(0, 150);
      const description = stripHtml(p.shortDescription || p.description || p.title).slice(0, 5000);

      const price = Number(p.price);
      const regularPrice = p.regularPrice ? Number(p.regularPrice) : null;
      const hasDiscount = regularPrice !== null && regularPrice > price;

      // Rupture de stock si explicitement désactivé OU quantité suivie tombée à 0 (une quantité non
      // suivie, stockQty = null, ne bloque pas la disponibilité — seul le drapeau inStock compte alors).
      const availability = p.inStock && p.stockQty !== 0 ? 'in stock' : 'out of stock';

      const additionalImages = (p.images || [])
        .filter((img) => img && img !== p.imageUrl)
        .slice(0, 10)
        .map((img) => `      <g:additional_image_link>${escapeXml(img)}</g:additional_image_link>`)
        .join('\n');

      return `    <item>
      <g:id>${escapeXml(p.id)}</g:id>
      <title><![CDATA[${title}]]></title>
      <g:title><![CDATA[${title}]]></g:title>
      <description><![CDATA[${description}]]></description>
      <g:description><![CDATA[${description}]]></g:description>
      <link>${escapeXml(link)}</link>
      <g:image_link>${escapeXml(p.imageUrl)}</g:image_link>
${additionalImages}
      <g:availability>${availability}</g:availability>
      <g:price>${(hasDiscount ? regularPrice! : price).toFixed(2)} EUR</g:price>
${hasDiscount ? `      <g:sale_price>${price.toFixed(2)} EUR</g:sale_price>\n` : ''}      <g:brand><![CDATA[${p.model.productLine.brand.name}]]></g:brand>
      <g:condition>${mapCondition(p.condition)}</g:condition>
      <g:identifier_exists>no</g:identifier_exists>
      <g:google_product_category>${GOOGLE_PRODUCT_CATEGORY}</g:google_product_category>
    </item>`;
    })
    .filter(Boolean)
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
  <channel>
    <title>ReparMonPhone — Pièces détachées &amp; accessoires téléphone</title>
    <link>${SITE_URL}</link>
    <description>Flux produits ReparMonPhone pour Google Merchant Center</description>
${items}
  </channel>
</rss>
`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
