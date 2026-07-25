'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';

const PIECE_TYPES = [
  { value: 'ECRAN', label: 'Écran' },
  { value: 'BATTERIE', label: 'Batterie' },
  { value: 'NAPPE_CONNECTEUR', label: 'Nappe / Connecteur' },
  { value: 'CAMERA', label: 'Caméra' },
  { value: 'VITRE_ARRIERE', label: 'Vitre arrière' },
  { value: 'OUTILLAGE', label: 'Outillage' },
];

type Model = { id: string; name: string; slug: string; productLineId: string };
type ProductLine = { id: string; name: string; slug: string; brandId: string };
type Brand = { id: string; name: string; slug: string };

export default function Filters({
  brands,
  lines,
  models,
}: {
  brands: Brand[];
  lines: ProductLine[];
  models: Model[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function updateParam(updates: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    router.push(`${pathname}?${next.toString()}`);
  }

  const selectedBrandSlug = params.get('marque');
  const selectedBrand = brands.find((b) => b.slug === selectedBrandSlug);
  const selectedLineSlug = params.get('gamme');
  const selectedLine = lines.find((l) => l.slug === selectedLineSlug && l.brandId === selectedBrand?.id);

  const filteredLines = selectedBrand ? lines.filter((l) => l.brandId === selectedBrand.id) : [];
  const filteredModels = selectedLine ? models.filter((m) => m.productLineId === selectedLine.id) : [];

  return (
    <div className="flex flex-wrap gap-3 mb-6">
      <select
        className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
        value={selectedBrandSlug ?? ''}
        onChange={(e) => updateParam({ marque: e.target.value || null, gamme: null, modele: null })}
      >
        <option value="">Toutes les marques</option>
        {brands.map((b) => (
          <option key={b.id} value={b.slug}>{b.name}</option>
        ))}
      </select>

      <select
        className="border border-gray-200 rounded-lg px-3 py-2 text-sm disabled:opacity-50"
        disabled={!selectedBrand}
        value={selectedLineSlug ?? ''}
        onChange={(e) => updateParam({ gamme: e.target.value || null, modele: null })}
      >
        <option value="">Toutes les gammes</option>
        {filteredLines.map((l) => (
          <option key={l.id} value={l.slug}>{l.name}</option>
        ))}
      </select>

      <select
        className="border border-gray-200 rounded-lg px-3 py-2 text-sm disabled:opacity-50"
        disabled={!selectedLine}
        value={params.get('modele') ?? ''}
        onChange={(e) => updateParam({ modele: e.target.value || null })}
      >
        <option value="">Tous les modèles</option>
        {filteredModels.map((m) => (
          <option key={m.id} value={m.slug}>{m.name}</option>
        ))}
      </select>

      <select
        className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
        value={params.get('type') ?? ''}
        onChange={(e) => updateParam({ type: e.target.value || null })}
      >
        <option value="">Toutes les pièces</option>
        {PIECE_TYPES.map((t) => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>
    </div>
  );
}
