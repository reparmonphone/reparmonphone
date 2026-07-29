import Link from 'next/link';
import { prisma } from '@/lib/prisma';

export default async function AdminGuidesPage() {
  const guides = await prisma.repairGuide.findMany({
    orderBy: { createdAt: 'desc' },
    include: { model: { include: { productLine: { include: { brand: true } } } } },
  });

  const difficultyLabel: Record<string, string> = { FACILE: '🟢 Facile', MOYEN: '🟡 Moyen', DIFFICILE: '🔴 Difficile' };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Guides de réparation</h1>
        <Link href="/admin/guides/nouveau" className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-dark transition">
          + Nouveau guide
        </Link>
      </div>

      {guides.length === 0 ? (
        <p className="text-gray-500">Aucun guide pour le moment.</p>
      ) : (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-3">Titre</th>
                <th className="px-4 py-3">Modèle lié</th>
                <th className="px-4 py-3">Difficulté</th>
                <th className="px-4 py-3">Vues</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {guides.map((g) => (
                <tr key={g.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{g.title}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {g.model ? `${g.model.productLine.brand.name} ${g.model.name}` : '— Général —'}
                  </td>
                  <td className="px-4 py-3">{difficultyLabel[g.difficulty]}</td>
                  <td className="px-4 py-3 text-gray-500">{g.viewCount}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${g.published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {g.published ? 'Publié' : 'Brouillon'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/guides/${g.id}`} className="text-brand hover:underline">Modifier</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
