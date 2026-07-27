import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ models: [], products: [] });
  }

  const [models, products] = await Promise.all([
    prisma.model.findMany({
      where: { name: { contains: q, mode: 'insensitive' } },
      include: { productLine: { include: { brand: true } } },
      orderBy: { name: 'asc' },
      take: 6,
    }),
    prisma.product.findMany({
      where: { title: { contains: q, mode: 'insensitive' } },
      orderBy: { title: 'asc' },
      take: 6,
    }),
  ]);

  return NextResponse.json({
    models: models.map((m) => ({
      id: m.id,
      name: m.name,
      brandSlug: m.productLine.brand.slug,
      brandName: m.productLine.brand.name,
      lineSlug: m.productLine.slug,
      lineName: m.productLine.name,
      modelSlug: m.slug,
    })),
    products: products.map((p) => ({ id: p.id, title: p.title, slug: p.slug, price: Number(p.price) })),
  });
}
