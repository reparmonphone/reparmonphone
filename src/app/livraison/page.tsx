import Link from 'next/link';
import { PREFECTURES } from '@/data/prefectures';

export const metadata = {
  title: 'Livraison de pièces détachées téléphone partout en France',
  description:
    'Nous livrons vos pièces détachées et accessoires pour smartphone partout en France via Chronopost, sous 24h en France métropolitaine. Retrouvez les informations de livraison pour votre ville.',
};

export default function LivraisonHubPage() {
  const parDepartement = new Map<string, typeof PREFECTURES>();
  for (const p of PREFECTURES) {
    const list = parDepartement.get(p.region) ?? [];
    list.push(p);
    parDepartement.set(p.region, list);
  }
  const regions = [...parDepartement.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div>
      <div className="bg-gray-50 border-b border-gray-100 py-10 text-center">
        <h1 className="text-3xl font-bold text-gray-900">Livraison partout en France</h1>
        <p className="text-gray-500 mt-2 max-w-xl mx-auto">
          Toutes nos commandes sont expédiées via Chronopost, avec une livraison estimée sous 24h pour la
          majorité du territoire métropolitain. Retrouve les informations pour ta ville.
        </p>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-10">
        {regions.map(([region, villes]) => (
          <div key={region} className="mb-8">
            <h2 className="font-bold text-gray-800 mb-3">{region}</h2>
            <div className="flex flex-wrap gap-2">
              {villes
                .sort((a, b) => a.ville.localeCompare(b.ville))
                .map((v) => (
                  <Link
                    key={v.slug}
                    href={`/livraison/${v.slug}`}
                    className="text-sm bg-white border border-gray-200 rounded-full px-3 py-1.5 hover:border-brand hover:text-brand transition"
                  >
                    {v.ville}
                  </Link>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
