import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Même correctif que src/app/boutique/page.tsx : une recherche "A52" ne doit pas remonter "A5 2017"
// (référence "A520F") juste parce que "52" y apparaît comme sous-chaîne. Voir le commentaire complet
// là-bas.
function matchesWholeWord(text: string, query: string): boolean {
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(text);
}

// "iPhone 16" est un début de mot valide de "iPhone 16 Pro Max" -> matchesWholeWord seul ne les
// sépare pas. Utilisé pour restreindre la liste de PRODUITS suggérés au modèle exact quand le texte
// tapé correspond pile au nom d'un modèle (la liste de MODÈLES suggérés, elle, reste volontairement
// large : voir plus bas).
function normalizeModelQuery(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ models: [], products: [] });
  }

  const [modelCandidates, productCandidates] = await Promise.all([
    prisma.model.findMany({
      where: { name: { contains: q, mode: 'insensitive' } },
      include: { productLine: { include: { brand: true } } },
      orderBy: { name: 'asc' },
      take: 40,
    }),
    prisma.product.findMany({
      where: { title: { contains: q, mode: 'insensitive' } },
      include: { model: { select: { name: true } } },
      orderBy: { title: 'asc' },
      take: 40,
    }),
  ]);

  const models = modelCandidates.filter((m) => matchesWholeWord(m.name, q)).slice(0, 6);

  const normQ = normalizeModelQuery(q);
  const exactModelNames = new Set(
    modelCandidates.filter((m) => normalizeModelQuery(m.name) === normQ).map((m) => m.name)
  );
  const products = (
    exactModelNames.size > 0
      ? productCandidates.filter((p) => exactModelNames.has(p.model.name))
      : productCandidates.filter((p) => matchesWholeWord(p.title, q))
  ).slice(0, 6);

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
