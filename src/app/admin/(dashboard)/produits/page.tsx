import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { formatPrice } from '@/lib/format';
import StockToggle from './StockToggle';

const PAGE_SIZE = 50;

export default async function AdminProduitsPage({
  searchParams,
}: {
  searchParams: { q?: string; stock?: string; page?: string };
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

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: { model: { include: { productLine: { include: { brand: true } } } } },
      orderBy: { title: 'asc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.product.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Produits & stock</h1>
        <span className="text-sm text-gray-500">{total} produits</span>
      </div>

      <form className="flex flex-wrap gap-3 mb-6" action="/admin/produits" method="get">
        <input
          type="text"
          name="q"
          defaultValue={searchParams.q}
          placeholder="Rechercher un produit..."
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1 min-w-[200px]"
        />
        <select name="stock" defaultValue={searchParams.stock ?? ''} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
          <option value="">Tous les stocks</option>
          <option value="dispo">En stock</option>
          <option value="rupture">Rupture</option>
        </select>
        <button type="submit" className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-dark transition">
          Filtrer
        </button>
      </form>

      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th className="px-4 py-3">Produit</th>
              <th className="px-4 py-3">Marque / Gamme</th>
              <th className="px-4 py-3">Prix</th>
              <th className="px-4 py-3">Stock</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {products.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800 max-w-xs truncate">{p.title}</td>
                <td className="px-4 py-3 text-gray-500">
                  {p.model.productLine.brand.name} / {p.model.productLine.name}
                </td>
                <td className="px-4 py-3">{formatPrice(Number(p.price))}</td>
                <td className="px-4 py-3">
                  <StockToggle productId={p.id} inStock={p.inStock} />
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/produits/${p.id}`} className="text-brand hover:underline">
                    Modifier
                  </Link>
                </td>
              </tr>
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
