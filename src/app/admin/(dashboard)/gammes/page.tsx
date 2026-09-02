import { prisma } from '@/lib/prisma';
import CatalogTree from './CatalogTree';

export default async function AdminGammesPage() {
  const brands = await prisma.brand.findMany({
    orderBy: { name: 'asc' },
    include: {
      lines: {
        orderBy: { sortOrder: 'asc' },
        include: {
          models: {
            orderBy: { sortOrder: 'asc' },
            include: { _count: { select: { products: true } } },
          },
        },
      },
    },
  });

  // Détecte les modèles "doublons" : même nom (insensible à la casse), présents dans plusieurs
  // gammes/marques — typiquement un reliquat de mauvaise catégorisation à la migration.
  type FlatModel = { id: string; name: string; productCount: number; brandName: string; lineName: string };
  const allModels: FlatModel[] = brands.flatMap((b) =>
    b.lines.flatMap((l) =>
      l.models.map((m) => ({ id: m.id, name: m.name, productCount: m._count.products, brandName: b.name, lineName: l.name }))
    )
  );

  const byName = new Map<string, FlatModel[]>();
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const m of allModels) {
    const key = normalize(m.name);
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key)!.push(m);
  }

  // Pour chaque modèle en doublon, on suggère de fusionner vers celui qui a le plus de produits
  // (généralement le "bon" à conserver).
  const mergeSuggestions = new Map<string, { targetId: string; targetLabel: string }>();
  for (const group of byName.values()) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => b.productCount - a.productCount);
    const best = sorted[0];
    for (const m of group) {
      if (m.id === best.id) continue;
      mergeSuggestions.set(m.id, { targetId: best.id, targetLabel: `${best.brandName} / ${best.lineName}` });
    }
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-1">Marques, gammes & modèles</h1>
      <p className="text-gray-500 mb-6">
        Ajoute des gammes, renomme-les, et déplace un modèle mal classé vers la bonne gamme (tous ses produits
        suivent automatiquement). Attrape une ligne par sa poignée <span className="font-medium">⠿</span> et
        glisse-la pour régler l'ordre d'affichage : celui des gammes sur la page publique de la marque, et celui
        des modèles sur la page publique de chaque gamme (une fois celle-ci dépliée). Les modèles en{' '}
        <span className="text-amber-600 font-medium">doublon</span> avec
        une autre gamme (souvent un reliquat de la migration) proposent une fusion en un clic. Un modèle avec des
        produits ne peut pas être supprimé directement (🗑 grisé) — utilise le bouton <span className="font-medium">🔀 fusionner</span> pour
        le regrouper dans un autre modèle existant : ses produits sont déplacés puis il est supprimé automatiquement.
      </p>

      <CatalogTree
        brands={brands.map((b) => ({
          id: b.id,
          name: b.name,
          slug: b.slug,
          lines: b.lines.map((l) => ({
            id: l.id,
            name: l.name,
            imageUrl: l.imageUrl,
            hubImageUrl: l.hubImageUrl,
            models: l.models.map((m) => ({
              id: m.id,
              name: m.name,
              imageUrl: m.imageUrl,
              productCount: m._count.products,
              mergeSuggestion: mergeSuggestions.get(m.id) ?? null,
              sortOrder: m.sortOrder,
              featuredOnHome: m.featuredOnHome,
            })),
          })),
        }))}
      />
    </div>
  );
}
