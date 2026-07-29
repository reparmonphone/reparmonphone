import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import GuideForm from '../GuideForm';

export default async function EditGuidePage({ params }: { params: { id: string } }) {
  const [guide, brands] = await Promise.all([
    prisma.repairGuide.findUnique({
      where: { id: params.id },
      include: { steps: { orderBy: { order: 'asc' } } },
    }),
    prisma.brand.findMany({
      orderBy: { name: 'asc' },
      include: {
        lines: {
          orderBy: { name: 'asc' },
          include: { models: { orderBy: { name: 'asc' } } },
        },
      },
    }),
  ]);

  if (!guide) notFound();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Modifier : {guide.title}</h1>
      <GuideForm
        brands={brands}
        initialGuide={{
          id: guide.id,
          title: guide.title,
          excerpt: guide.excerpt ?? '',
          coverImageUrl: guide.coverImageUrl ?? '',
          modelId: guide.modelId,
          difficulty: guide.difficulty,
          estimatedTime: guide.estimatedTime ?? '',
          toolsNeeded: guide.toolsNeeded,
          partsNeeded: guide.partsNeeded,
          published: guide.published,
          metaTitle: guide.metaTitle ?? '',
          metaDescription: guide.metaDescription ?? '',
          steps: guide.steps.map((s) => ({
            title: s.title,
            contentHtml: s.contentHtml,
            imageUrl: s.imageUrl ?? '',
            warning: s.warning ?? '',
          })),
        }}
      />
    </div>
  );
}
