import Link from 'next/link';
import { getFavoriteProducts } from './actions';
import FavoriteButton from '@/components/FavoriteButton';
import { formatPrice } from '@/lib/format';

export default async function FavorisPage() {
  const products = await getFavoriteProducts();

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold mb-6">Mes Favoris</h1>

      {products.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-xl p-8 text-center text-gray-500">
          <p className="mb-4">Vous n&apos;avez pas encore de produit favori.</p>
          <Link href="/boutique" className="text-brand hover:underline">
            Découvrir la boutique →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {products.map((product) => (
            <div key={product.id} className="bg-white border border-gray-100 rounded-xl overflow-hidden relative">
              <FavoriteButton
                productId={product.id}
                initialFavorited
                className="absolute top-2 right-2 z-10 bg-white/90 rounded-full p-1.5 shadow"
              />
              <Link href={`/produit/${product.slug}`}>
                {product.imageUrl && (
                  <img src={product.imageUrl} alt={product.title} className="w-full h-32 object-contain p-4" />
                )}
                <div className="p-3 pt-0">
                  <p className="text-sm text-gray-700 truncate">{product.title}</p>
                  <p className="font-bold mt-1">{formatPrice(Number(product.price))}</p>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
