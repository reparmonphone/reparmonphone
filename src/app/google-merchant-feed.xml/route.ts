import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PIECE_TYPE_LABELS } from '@/lib/seoText';

// Flux produits au format Google Merchant Center (RSS 2.0 + espace de noms g:), disponible sur
// /google-merchant-feed.xml. Dans Merchant Center : Produits > Flux > Ajouter un flux > "Récupération
// programmée" avec cette URL. C'est ce qui permet aux produits d'apparaître GRATUITEMENT dans Google
// Shopping / l'onglet Images / les résultats « Acheter » partout en France.
// Les frais de port et la politique de retour se règlent dans Merchant Center (Paramètres > Livraison et
// retours), pas ici : ils dépendent de tes options et zones, que Google lit mieux depuis son propre menu.
// Régénéré au maximum toutes les heures (sans solliciter la base à chaque lecture par Google).
export const revalidate = 3600;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.reparmonphone.fr';

function xml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    // caractères de contrôle interdits en XML 1.0
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

function plain(html: string | null | undefined): string {
  return (html ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function money(n: unknown): string {
  return `${Number(n).toFixed(2)} EUR`;
}

export async function GET() {
  const products = await prisma.product.findMany({
    where: { showInBoutique: true },
    include: { model: { include: { productLine: { include: { brand: true } } } } },
    orderBy: { createdAt: 'asc' },
  });

  const items = products
    .filter((p) => Number(p.price) > 0 && (p.imageUrl || p.images?.[0]))
    .map((p) => {
      const image = p.imageUrl || p.images[0];
      const brand = p.model.productLine.brand.name;
      const pieceLabel = PIECE_TYPE_LABELS[p.pieceType];
      const description =
        plain(p.metaDescription) ||
        plain(p.shortDescription) ||
        plain(p.description).slice(0, 900) ||
        `${p.title} : ${pieceLabel} de remplacement pour ${brand} ${p.model.name}.`;
      const condition = /occasion/i.test(p.condition ?? '') ? 'used' : /reconditionn/i.test(p.condition ?? '') ? 'refurbished' : 'new';
      const onSale = p.regularPrice && Number(p.regularPrice) > Number(p.price);
      const extraImages = (p.images ?? []).filter((u) => u && u !== image).slice(0, 10);

      return `    <item>
      <g:id>${xml(p.id)}</g:id>
      <title>${xml(p.title.slice(0, 150))}</title>
      <description>${xml(description.slice(0, 5000))}</description>
      <link>${xml(`${SITE_URL}/produit/${p.slug}`)}</link>
      <g:image_link>${xml(image)}</g:image_link>
${extraImages.map((u) => `      <g:additional_image_link>${xml(u)}</g:additional_image_link>`).join('\n')}
      <g:availability>${p.inStock ? 'in_stock' : 'out_of_stock'}</g:availability>
      <g:price>${money(onSale ? p.regularPrice : p.price)}</g:price>
${onSale ? `      <g:sale_price>${money(p.price)}</g:sale_price>\n` : ''}      <g:brand>${xml(brand)}</g:brand>
      <g:condition>${condition}</g:condition>
      <g:identifier_exists>no</g:identifier_exists>
      <g:product_type>${xml(`${brand} > ${p.model.productLine.name} > ${p.model.name}`)}</g:product_type>
      <g:google_product_category>Electronics &gt; Communications &gt; Telephony &gt; Mobile Phone Accessories</g:google_product_category>
    </item>`;
    })
    .join('\n');

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>ReparMonPhone</title>
    <link>${xml(SITE_URL)}</link>
    <description>Pièces détachées et accessoires pour téléphones et tablettes — livraison partout en France</description>
${items}
  </channel>
</rss>`;

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
