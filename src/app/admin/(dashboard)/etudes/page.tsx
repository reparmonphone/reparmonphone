import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { STUDY_IMPORTS } from '@/data/etudes';
import EtudesActions from './EtudesActions';
import Indicateurs from './Indicateurs';

export default async function AdminEtudesPage() {
  const studies = await prisma.study.findMany({
    orderBy: { createdAt: 'desc' },
    include: { tasks: { select: { status: true } } },
  });
  const importedSlugs = new Set(studies.map((s) => s.slug));
  const available = STUDY_IMPORTS.filter((s) => !importedSlugs.has(s.slug)).map((s) => ({
    slug: s.slug,
    title: s.title,
    taskCount: s.tasks.length,
    doneCount: s.tasks.filter((t) => t.status === 'DONE').length,
  }));

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-1">🧪 Études</h1>
      <p className="text-gray-500 mb-6">
        Les rapports d&apos;analyse (MiroFish…) et les actions à mener qui en découlent, suivies une par une.
      </p>

      <Indicateurs />

      <div className="space-y-3 mb-8">
        {studies.length === 0 && (
          <p className="text-gray-500 bg-white border border-gray-100 rounded-xl p-5">
            Aucune étude pour le moment. Importe une étude MiroFish ou crées-en une ci-dessous.
          </p>
        )}
        {studies.map((s) => {
          const total = s.tasks.length;
          const done = s.tasks.filter((t) => t.status === 'DONE').length;
          const doing = s.tasks.filter((t) => t.status === 'IN_PROGRESS').length;
          const pct = total ? Math.round((done / total) * 100) : 0;
          return (
            <Link
              key={s.id}
              href={`/admin/etudes/${s.id}`}
              className="block bg-white border border-gray-100 rounded-xl p-5 hover:border-brand transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-semibold text-gray-900">{s.title}</h2>
                <span className="text-xs text-gray-400 shrink-0">
                  {s.createdAt.toLocaleDateString('fr-FR')}
                </span>
              </div>
              {s.summary && <p className="text-sm text-gray-600 mt-1 line-clamp-2">{s.summary}</p>}
              <div className="mt-3 flex items-center gap-3">
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs text-gray-500 shrink-0">
                  {done}/{total} faites{doing > 0 ? ` · ${doing} en cours` : ''}
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      <EtudesActions available={available} />
    </div>
  );
}
