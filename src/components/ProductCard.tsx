import Image from 'next/image';
import Link from 'next/link';
import { formatPrice } from '@/lib/format';
import ProductStars from './ProductStars';
import FavoriteButton from './FavoriteButton';

export type ProductCardData = {
  id: string;
  slug: string;
  title: string;
  price: number;
  imageUrl: string | null;
  inStock: boolean;
  brandName: string;
  modelName: string;
  avgRating?: number | null;
  reviewCount?: number;
};

export default function ProductCard({
  product,
  favorited = false,
}: {
  product: ProductCardData;
  favorited?: boolean;
}) {
  return (
    <div className="group relative flex flex-col rounded-xl border border-gray-100 bg-white overflow-hidden hover:shadow-md transition">
      <FavoriteButton
        productId={product.id}
        initialFavorited={favorited}
        className="absolute top-2 right-2 z-10 bg-white/90 rounded-full p-1.5 shadow-sm"
      />

      <Link href={`/produit/${product.slug}`} className="flex flex-col flex-1">
        <div className="relative aspect-square bg-gray-50">
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.title}
              fill
              className="object-contain p-4 group-hover:scale-105 transition"
              sizes="(max-width: 768px) 50vw, 25vw"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300 text-3xl">📱</div>
          )}
          {!product.inStock && (
            <span className="absolute top-2 left-2 bg-gray-800 text-white text-xs px-2 py-1 rounded">
              Rupture
            </span>
          )}
        </div>
        <div className="p-3 flex flex-col gap-1 flex-1">
          <span className="text-xs text-gray-400">{product.brandName} · {product.modelName}</span>
          <h3 className="text-sm font-medium text-gray-800 line-clamp-2 flex-1">{product.title}</h3>
          <ProductStars rating={product.avgRating ?? null} count={product.reviewCount ?? 0} size="text-xs" />
          <span className="text-brand-dark font-bold">{formatPrice(product.price)}</span>
        </div>
      </Link>
    </div>
  );
}