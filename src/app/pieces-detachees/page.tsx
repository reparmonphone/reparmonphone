import Link from 'next/link';
import type { Metadata } from 'next';
import type { PieceType } from '@prisma/client';
import { getLandingCombos, landingPieceByType, LANDING_PIECES, MIN_INDEXABLE_PRODUCTS } from '@/lib/landingPages';

export const revalidate = 3600;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.reparmonphone.fr';

export const metadata: Metadata = {
  title: 'Pièces détachées smartphone par marque : livraison 24h France',
  description:
    'Écrans, batteries, connecteurs de charge, caméras… Trouve la pièce détachée de ton smartphone par marque et par gamme. Livraison Chronopost 24h partout en France métropolitaine.',
  alternates: { canonical: `${SITE_URL}/pieces-detachees` },
};

export default async function PiecesDetacheesIndex() {
  const combos = (await getLandingCombos()).filter((c) => c.count >= 1);

  // Regroupe par marque, puis par gamme : { brand -> { line -> pièces } }
  const byBrand = new Map<string, { name: string; lines: Map<string, { name: string; types: Set<PieceType> }>; types: Map<PieceType, number> }>();
  for (const c of combos) {
    const b = byBrand.get(c.brandSlug) ?? { name: c.brandName, lines: new Map(), types: new Map() };
    b.types.set(c.type, (b.types.get(c.type) ?? 0) + c.count);
    const l = b.lines.get(c.lineSlug) ?? { name: c.lineName, types: new Set<PieceType>() };
    if (c.count >= MIN_INDEXABLE_PRODUCTS) l.types.add(c.type);
    b.lines.set(c.lineSlug, l);
    byBrand.set(c.brandSlug, b);
  }
  const brands = Array.from(byBrand.entries()).sort((a, b) => a[1].name.localeCompare(b[1].name, 'fr'));

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900">Pièces détachées smartphone par marque</h1>
      <p className="mt-3 text-gray-600 max-w-3xl">
        Choisis ta marque puis la pièce dont tu as besoin. Livraison Chronopost 24h disponible partout en France métropolitaine.
      </p>

      <div className="mt-8 space-y-8">
        {brands.map(([brandSlug, b]) => (
          <section key={brandSlug}>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">{b.name}</h2>
            <div className="flex flex-wrap gap-2 mb-3">
              {LANDING_PIECES.filter((p) => (b.types.get(p.type) ?? 0) >= MIN_INDEXABLE_PRODUCTS).map((p) => (
                <Link
                  key={p.slug}
                  href={`/pieces-detachees/${brandSlug}/${p.slug}`}
                  className="px-3 py-1.5 rounded-full bg-brand text-white text-sm hover:opacity-90"
                >
                  {p.plural} {b.name}
                </Link>
              ))}
            </div>
            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1 text-sm">
              {Array.from(b.lines.entries()).map(([lineSlug, l]) =>
                Array.from(l.types).map((t) => {
                  const p = landingPieceByType(t);
                  if (!p) return null;
                  return (
                    <li key={`${lineSlug}/${t}`}>
                      <Link href={`/pieces-detachees/${brandSlug}/${lineSlug}/${p.slug}`} className="text-gray-600 hover:text-brand-dark hover:underline">
                        {p.plural} {l.name}
                      </Link>
                    </li>
                  );
                })
              )}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
