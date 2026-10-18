import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import StudyDetail from './StudyDetail';

export default async function AdminEtudePage({ params }: { params: { id: string } }) {
  const study = await prisma.study.findUnique({
    where: { id: params.id },
    include: { tasks: { orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] } },
  });
  if (!study) notFound();

  return (
    <div className="max-w-3xl">
      <Link href="/admin/etudes" className="text-sm text-brand hover:underline">
        ← Toutes les études
      </Link>
      <StudyDetail
        study={{
          id: study.id,
          title: study.title,
          question: study.question,
          summary: study.summary,
          findings: study.findings,
          report: study.report ?? '',
        }}
        tasks={study.tasks.map((t) => ({
          id: t.id,
          title: t.title,
          description: t.description,
          notes: t.notes,
          status: t.status,
          doneAt: t.doneAt ? t.doneAt.toISOString() : null,
        }))}
      />
    </div>
  );
}
