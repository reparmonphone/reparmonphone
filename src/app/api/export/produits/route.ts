import { requireAdminUser } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';
import { toCsv, csvResponse } from '@/lib/csv';

export async function GET() {
  await requireAdminUser();

  const products = await prisma.product.findMany({
    include: { model: { include: { productLine: { include: { brand: true } } } } },
    orderBy: { title: 'asc' },
  });

  const rows = products.map((p) => [
    p.title,
    p.model.productLine.brand.name,
    p.model.productLine.name,
    p.model.name,
    Number(p.price).toFixed(2),
    p.regularPrice ? Number(p.regularPrice).toFixed(2) : '',
    p.inStock ? 'Oui' : 'Non',
    p.stockQty ?? '',
    p.showInBoutique ? 'Oui' : 'Non',
    p.avgRating ? p.avgRating.toFixed(1) : '',
    p.reviewCount,
    p.slug,
  ]);

  const csv = toCsv(
    ['Titre', 'Marque', 'Gamme', 'Modèle', 'Prix', 'Prix barré', 'En stock', 'Quantité', 'Visible boutique', 'Note moyenne', 'Nb avis', 'Slug'],
    rows
  );

  return csvResponse(csv, `produits-reparmonphone-${new Date().toISOString().slice(0, 10)}.csv`);
}
