import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';

export async function getPage(slug: string) {
  return prisma.page.findUnique({ where: { slug } });
}

export default async function StaticPage({ slug }: { slug: string }) {
  const page = await getPage(slug);
  if (!page) notFound();

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div
        className="prose prose-sm md:prose-base max-w-none text-gray-700
          [&_h1]:text-2xl [&_h1]:font-bold
          [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-8
          [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-6
          [&_a]:text-brand
          [&_img]:max-w-full [&_img]:h-auto [&_img]:w-auto [&_img]:mx-auto [&_img]:rounded-lg [&_img]:block
          [&_table]:w-full [&_table]:max-w-full
          [&_iframe]:max-w-full"
        dangerouslySetInnerHTML={{ __html: page.contentHtml }}
      />
    </div>
  );
}
