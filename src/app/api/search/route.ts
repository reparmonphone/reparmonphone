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

// Une recherche tapée par un client contient souvent plusieurs mots qui n'apparaissent pas forcément
// côte à côte, ni dans le même ordre, dans le titre du produit (ex: "verre trempé iphone 14" ne
// correspond à aucun titre tel quel, car les titres sont plutôt "Verre trempé intégral iPhone 14 Pro
// ..." — un mot ("intégral") s'intercale). Traiter la requête comme UNE SEULE chaîne à retrouver telle
// quelle ne remontait donc jamais rien dès que la recherche dépassait un mot. On découpe maintenant la
// requête en mots et on exige que CHACUN apparaisse quelque part dans le titre (peu importe l'ordre).
function tokenize(q: string): string[] {
  return q.split(/\s+/).map((t) => t.trim()).filter(Boolean);
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ models: [], products: [] });
  }

  const terms = tokenize(q);

  const [modelCandidates, productCandidates] = await Promise.all([
    prisma.model.findMany({
      where: { AND: terms.map((t) => ({ name: { contains: t, mode: 'insensitive' } })) },
      include: { productLine: { include: { brand: true } } },
      orderBy: { name: 'asc' },
      take: 40,
    }),
    prisma.product.findMany({
      where: { AND: terms.map((t) => ({ title: { contains: t, mode: 'insensitive' } })) },
      include: { model: { select: { name: true } } },
      orderBy: { title: 'asc' },
      take: 40,
    }),
  ]);

  const models = modelCandidates.filter((m) => terms.every((t) => matchesWholeWord(m.name, t))).slice(0, 6);

  const normQ = normalizeModelQuery(q);
  const exactModelNames = new Set(
    modelCandidates.filter((m) => normalizeModelQuery(m.name) === normQ).map((m) => m.name)
  );
  const products = (
    exactModelNames.size > 0
      ? productCandidates.filter((p) => exactModelNames.has(p.model.name))
      : productCandidates.filter((p) => terms.every((t) => matchesWholeWord(p.title, t)))
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
