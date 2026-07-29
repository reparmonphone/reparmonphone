import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { formatPrice } from '@/lib/format';
import { PREFECTURES } from '@/data/prefectures';
import JsonLd from '@/components/JsonLd';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.reparmonphone.fr';

// Petites variations de phrase d'intro selon la région, pour éviter un contenu trop répétitif
// d'une page à l'autre (au-delà des données déjà différenciées : département, région, ventes).
const REGION_INTRO: Record<string, string> = {
  'Île-de-France': "En région parisienne, la demande de pièces détachées est forte : nous expédions chaque jour vers l'Île-de-France.",
  'Provence-Alpes-Côte d\u2019Azur': 'Notre atelier est basé en Provence-Alpes-Côte d\u2019Azur, à Sainte-Maxime — la région où tout a commencé.',
  'Auvergne-Rhône-Alpes': 'De Lyon à Grenoble, la région Auvergne-Rhône-Alpes fait partie de nos zones de livraison les plus actives.',
  'Occitanie': 'De Toulouse à Montpellier, nous livrons régulièrement dans toute l\u2019Occitanie.',
  'Nouvelle-Aquitaine': 'De Bordeaux à Limoges, la Nouvelle-Aquitaine est l\u2019une de nos régions de livraison les plus fidèles.',
  'Hauts-de-France': 'Même à l\u2019autre bout de la France, les Hauts-de-France sont livrés aussi vite que le reste du pays.',
  'Grand Est': 'De Strasbourg à Nancy, le Grand Est bénéficie du même délai de livraison Chronopost que partout ailleurs.',
  'Normandie': 'La Normandie, malgré la distance avec notre atelier varois, reste livrée en 24h via Chronopost.',
  'Bretagne': 'Jusqu\u2019en Bretagne, nos colis Chronopost arrivent aussi vite qu\u2019en région parisienne.',
  'Pays de la Loire': 'Les Pays de la Loire font partie des régions régulièrement livrées par nos soins.',
  'Centre-Val de Loire': 'Le Centre-Val de Loire, au cœur de la France, est livré en un temps record grâce à Chronopost.',
  'Bourgogne-Franche-Comté': 'La Bourgogne-Franche-Comté bénéficie du même service de livraison rapide que le reste du territoire.',
  'Corse': 'Même en Corse, séparée par la mer, nos colis Chronopost arrivent généralement sous 48h.',
};

export async function generateStaticParams() {
  return PREFECTURES.map((p) => ({ ville: p.slug }));
}

export async function generateMetadata({ params }: { params: { ville: string } }) {
  const prefecture = PREFECTURES.find((p) => p.slug === params.ville);
  if (!prefecture) return {};
  return {
    title: `Pièces détachées téléphone à ${prefecture.ville} — Livraison 24h | ReparMonPhone`,
    description: `Commandez vos pièces détachées et accessoires pour smartphone (écrans, batteries, connecteurs) et faites-vous livrer à ${prefecture.ville} en 24h via Chronopost. Apple, Samsung, Huawei, Xiaomi.`,
  };
}

export default async function VillePage({ params }: { params: { ville: string } }) {
  const prefecture = PREFECTURES.find((p) => p.slug === params.ville);
  if (!prefecture) notFound();

  const isVar = prefecture.departementNumero === '83';

  // Top des produits les plus vendus, calculé à la volée sur les commandes réelles — rend
  // chaque page dynamique et réellement utile plutôt qu'un simple gabarit avec le nom qui change.
  const topProductIds = await prisma.orderItem.groupBy({
    by: ['productId'],
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: 'desc' } },
    take: 6,
  });
  const topProducts = topProductIds.length
    ? await prisma.product.findMany({
        where: { id: { in: topProductIds.map((p) => p.productId) }, showInBoutique: true, inStock: true },
        select: { id: true, title: true, slug: true, price: true, imageUrl: true },
      })
    : await prisma.product.findMany({
        where: { showInBoutique: true, inStock: true },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: { id: true, title: true, slug: true, price: true, imageUrl: true },
      });

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Livraison en France', item: `${SITE_URL}/livraison` },
      { '@type': 'ListItem', position: 3, name: prefecture.ville, item: `${SITE_URL}/livraison/${prefecture.slug}` },
    ],
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <JsonLd data={breadcrumbSchema} />

      <p className="text-sm text-gray-400 mb-2">
        <Link href="/livraison" className="hover:text-brand">Livraison en France</Link>
        <span className="mx-1">›</span>
        {prefecture.ville}
      </p>

      <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
        Pièces détachées téléphone à {prefecture.ville}
      </h1>
      <p className="text-gray-500 mb-6">
        {prefecture.departement} ({prefecture.departementNumero}) — {prefecture.region}
      </p>

      <div className="bg-brand-light/40 border border-brand/20 rounded-xl p-5 mb-8">
        <p className="text-gray-700 leading-relaxed">
          {REGION_INTRO[prefecture.region] ??
            `Nous expédions vers ${prefecture.ville} et l\u2019ensemble du département ${prefecture.departement} comme partout en France.`}{' '}
          Toutes nos commandes sont expédiées via <strong>Chronopost</strong>, avec une livraison estimée sous <strong>24h</strong> pour la majorité du territoire métropolitain.
        </p>
        {isVar && (
          <p className="text-gray-700 leading-relaxed mt-3">
            📍 Bonne nouvelle si tu es dans le Var : notre atelier est basé à <strong>Sainte-Maxime</strong>. Tu peux{' '}
            <Link href="/rdv" className="text-brand font-medium hover:underline">prendre rendez-vous</Link> pour une réparation directement sur place, en plus de la commande de pièces en ligne.
          </p>
        )}
      </div>

      <h2 className="text-lg font-bold mb-4">Nos pièces les plus commandées en ce moment</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
        {topProducts.map((product) => (
          <Link
            key={product.id}
            href={`/produit/${product.slug}`}
            className="bg-white border border-gray-100 rounded-xl overflow-hidden hover:shadow-md transition"
          >
            {product.imageUrl && (
              <img src={product.imageUrl} alt={product.title} className="w-full h-28 object-contain p-3" />
            )}
            <div className="p-3 pt-0">
              <p className="text-sm text-gray-700 line-clamp-2">{product.title}</p>
              <p className="font-bold text-brand-dark mt-1">{formatPrice(Number(product.price))}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-10">
        <Link href="/boutique" className="bg-white border border-gray-100 rounded-xl p-5 hover:shadow-md transition">
          <p className="font-semibold text-gray-800">🛒 Voir toute la boutique</p>
          <p className="text-sm text-gray-500 mt-1">Écrans, batteries, connecteurs, outillage et accessoires.</p>
        </Link>
        <Link href="/reparation" className="bg-white border border-gray-100 rounded-xl p-5 hover:shadow-md transition">
          <p className="font-semibold text-gray-800">🔧 Nos guides de réparation</p>
          <p className="text-sm text-gray-500 mt-1">Des tutoriels étape par étape pour réparer soi-même.</p>
        </Link>
      </div>

      <div className="text-center text-sm text-gray-400">
        <Link href="/livraison" className="hover:text-brand">← Voir toutes les villes livrées</Link>
      </div>
    </div>
  );
}
