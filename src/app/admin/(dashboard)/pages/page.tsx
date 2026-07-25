import Link from 'next/link';
import { prisma } from '@/lib/prisma';

export default async function AdminPagesPage() {
  const pages = await prisma.page.findMany({ orderBy: { title: 'asc' } });

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-1">Pages de contenu</h1>
      <p className="text-gray-500 mb-6">À propos, Mentions légales, CGV, Confidentialité, Livraison & Retours.</p>

      <div className="bg-white border border-gray-100 rounded-xl divide-y divide-gray-100">
        {pages.map((p) => (
          <div key={p.id} className="p-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">{p.title}</p>
              <p className="text-xs text-gray-400">/{p.slug}</p>
            </div>
            <Link href={`/admin/pages/${p.id}`} className="text-brand text-sm font-medium hover:underline">
              Modifier
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
