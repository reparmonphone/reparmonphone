import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import ProductRowInline from './ProductRowInline';

const PAGE_SIZE = 50;

export default async function AdminProduitsPage({
  searchParams,
}: {
  searchParams: { q?: string; stock?: string; marque?: string; page?: string };
}) {
  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1);
  const where: Record<string, unknown> = {};

  if (searchParams.q) {
    where.title = { contains: searchParams.q, mode: 'insensitive' };
  }
  if (searchParams.stock === 'rupture') {
    where.inStock = false;
  } else if (searchParams.stock === 'dispo') {
    where.inStock = true;
  }
  if (searchParams.marque) {
    where.model = { productLine: { brand: { slug: searchParams.marque } } };
  }

  const [products, total, brands] = await Promise.all([
    prisma.product.findMany({
      where,
      include: { model: { include: { productLine: { include: { brand: true } } } } },
      orderBy: { title: 'asc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.product.count({ where }),
    // Hiérarchie complète chargée UNE fois pour alimenter les sélecteurs en cascade de chaque ligne
    prisma.brand.findMany({
      orderBy: { name: 'asc' },
      include: {
        lines: {
          orderBy: { name: 'asc' },
          include: { models: { orderBy: { name: 'asc' } } },
        },
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Produits & stock</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{total} produits</span>
          <a href="/api/export/produits" className="text-sm bg-gray-800 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 transition">
            ⬇️ Exporter CSV
          </a>
          <Link href="/admin/produits/nouveau" className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-dark transition">
            + Nouveau produit
          </Link>
        </div>
      </div>

      <p className="text-sm text-gray-500 mb-4">
        Corrige directement la Marque / Gamme / Modèle d&apos;un produit mal classé depuis les menus déroulants
        ci-dessous — enregistrement automatique, pas besoin d&apos;ouvrir la fiche. Clique sur{' '}
        <strong>Modifier</strong> pour changer le prix, les photos ou les descriptions.
      </p>

      <form className="flex flex-wrap gap-3 mb-6" action="/admin/produits" method="get">
        <input
          type="text"
          name="q"
          defaultValue={searchParams.q}
          placeholder="Rechercher un produit..."
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1 min-w-[200px]"
        />
        <select name="marque" defaultValue={searchParams.marque ?? ''} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
          <option value="">Toutes les marques</option>
          {brands.map((b) => (
            <option key={b.id} value={b.slug}>{b.name}</option>
          ))}
        </select>
        <select name="stock" defaultValue={searchParams.stock ?? ''} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
          <option value="">Tous les stocks</option>
          <option value="dispo">En stock</option>
          <option value="rupture">Rupture</option>
        </select>
        <button type="submit" className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-dark transition">
          Filtrer
        </button>
      </form>

      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th className="px-4 py-3">Produit</th>
              <th className="px-4 py-3">Marque</th>
              <th className="px-4 py-3">Gamme</th>
              <th className="px-4 py-3">Modèle</th>
              <th className="px-4 py-3">Prix</th>
              <th className="px-4 py-3">Stock</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {products.map((p) => (
              <ProductRowInline
                key={p.id}
                brands={brands}
                product={{
                  id: p.id,
                  title: p.title,
                  price: Number(p.price),
                  inStock: p.inStock,
                  modelId: p.modelId,
                  brandId: p.model.productLine.brandId,
                  productLineId: p.model.productLineId,
                }}
              />
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6 text-sm">
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .slice(Math.max(0, page - 3), page + 2)
            .map((p) => (
              <Link
                key={p}
                href={`/admin/produits?${new URLSearchParams({ ...searchParams, page: String(p) } as Record<string, string>).toString()}`}
                className={`w-8 h-8 flex items-center justify-center rounded-lg ${
                  p === page ? 'bg-brand text-white' : 'bg-white border border-gray-200 text-gray-600'
                }`}
              >
                {p}
              </Link>
            ))}
        </div>
      )}
    </div>
  );
}
