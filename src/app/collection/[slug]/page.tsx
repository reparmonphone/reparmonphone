import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import ProductCard from '@/components/ProductCard';

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const collection = await prisma.collection.findUnique({ where: { slug: params.slug } });
  if (!collection) return {};
  return { title: `${collection.name} | ReparMonPhone` };
}

export default async function CollectionPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { marque?: string; modele?: string };
}) {
  const collection = await prisma.collection.findUnique({ where: { slug: params.slug } });
  if (!collection) notFound();

  const products = collection.productIds.length
    ? await prisma.product.findMany({
        where: { id: { in: collection.productIds } },
        include: { model: { include: { productLine: { include: { brand: true } } } } },
        orderBy: { title: 'asc' },
      })
    : [];

  if (products.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold mb-4">{collection.name}</h1>
        <p className="text-gray-500">Aucun produit dans cette collection pour le moment.</p>
      </div>
    );
  }

  // Niveau 3 : marque + modèle choisis -> grille de produits
  if (searchParams.marque && searchParams.modele) {
    const filtered = products.filter(
      (p) =>
        p.model.productLine.brand.slug === searchParams.marque && p.model.slug === searchParams.modele
    );
    const modelName = filtered[0]?.model.name ?? searchParams.modele;

    return (
      <div className="max-w-6xl mx-auto px-4 py-10">
        <Breadcrumb collectionName={collection.name} collectionSlug={collection.slug} marque={searchParams.marque} brandName={filtered[0]?.model.productLine.brand.name} />
        <h1 className="text-2xl font-bold mb-6">{collection.name} — {modelName}</h1>
        {filtered.length === 0 ? (
          <p className="text-gray-500">Aucun produit ici.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {filtered.map((p) => (
              <ProductCard
                key={p.id}
                product={{
                  id: p.id,
                  slug: p.slug,
                  title: p.title,
                  price: Number(p.price),
                  imageUrl: p.imageUrl,
                  inStock: p.inStock,
                  brandName: p.model.productLine.brand.name,
                  modelName: p.model.name,
                  avgRating: p.avgRating,
                  reviewCount: p.reviewCount,
                }}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Niveau 2 : marque choisie -> liste des modèles disponibles dans cette collection pour cette marque
  if (searchParams.marque) {
    const brandProducts = products.filter((p) => p.model.productLine.brand.slug === searchParams.marque);
    const brandName = brandProducts[0]?.model.productLine.brand.name ?? searchParams.marque;

    const modelMap = new Map<string, { slug: string; name: string; count: number; imageUrl: string | null }>();
    for (const p of brandProducts) {
      const key = p.model.slug;
      const existing = modelMap.get(key);
      if (existing) existing.count += 1;
      else modelMap.set(key, { slug: p.model.slug, name: p.model.name, count: 1, imageUrl: p.imageUrl });
    }

    return (
      <div className="max-w-6xl mx-auto px-4 py-10">
        <Breadcrumb collectionName={collection.name} collectionSlug={collection.slug} />
        <h1 className="text-2xl font-bold mb-6">{collection.name} — {brandName}</h1>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6">
          {Array.from(modelMap.values()).map((m) => (
            <Link key={m.slug} href={`/collection/${collection.slug}?marque=${searchParams.marque}&modele=${m.slug}`} className="text-center group">
              <div className="aspect-square bg-white border border-gray-100 rounded-xl mb-2 flex items-center justify-center overflow-hidden relative">
                {m.imageUrl ? (
                  <Image src={m.imageUrl} alt={m.name} fill className="object-contain p-3 group-hover:scale-105 transition" sizes="200px" />
                ) : (
                  <span className="text-3xl text-gray-200">📱</span>
                )}
              </div>
              <p className="text-sm font-medium text-gray-800 group-hover:text-brand">{m.name}</p>
              <p className="text-xs text-gray-400">{m.count} produit{m.count > 1 ? 's' : ''}</p>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  // Niveau 1 : liste des marques présentes dans cette collection
  const brandMap = new Map<string, { slug: string; name: string; count: number; imageUrl: string | null }>();
  for (const p of products) {
    const key = p.model.productLine.brand.slug;
    const existing = brandMap.get(key);
    if (existing) existing.count += 1;
    else brandMap.set(key, { slug: key, name: p.model.productLine.brand.name, count: 1, imageUrl: p.imageUrl });
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-2">{collection.name}</h1>
      <p className="text-gray-500 mb-6">Choisis une marque pour voir les modèles disponibles.</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
        {Array.from(brandMap.values()).map((b) => (
          <Link key={b.slug} href={`/collection/${collection.slug}?marque=${b.slug}`} className="text-center group">
            <div className="aspect-square bg-white border border-gray-100 rounded-xl mb-2 flex items-center justify-center overflow-hidden relative">
              {b.imageUrl ? (
                <Image src={b.imageUrl} alt={b.name} fill className="object-contain p-6 group-hover:scale-105 transition" sizes="200px" />
              ) : (
                <span className="text-3xl text-gray-200">📱</span>
              )}
            </div>
            <p className="font-semibold text-gray-800 group-hover:text-brand">{b.name}</p>
            <p className="text-xs text-gray-400">{b.count} produit{b.count > 1 ? 's' : ''}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Breadcrumb({
  collectionName,
  collectionSlug,
  marque,
  brandName,
}: {
  collectionName: string;
  collectionSlug: string;
  marque?: string;
  brandName?: string;
}) {
  return (
    <p className="text-sm text-gray-400 mb-4">
      <Link href={`/collection/${collectionSlug}`} className="hover:text-brand">{collectionName}</Link>
      {marque && (
        <>
          <span className="mx-1">›</span>
          <Link href={`/collection/${collectionSlug}?marque=${marque}`} className="hover:text-brand">{brandName ?? marque}</Link>
        </>
      )}
    </p>
  );
}
