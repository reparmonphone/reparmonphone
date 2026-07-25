import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import PageEditForm from './PageEditForm';

export default async function AdminPageEditPage({ params }: { params: { id: string } }) {
  const page = await prisma.page.findUnique({ where: { id: params.id } });
  if (!page) notFound();

  return (
    <div className="max-w-4xl">
      <Link href="/admin/pages" className="text-sm text-gray-500 hover:text-gray-800">← Retour aux pages</Link>
      <h1 className="text-2xl font-bold mt-2 mb-1">{page.title}</h1>
      <p className="text-gray-500 mb-6">
        Visible sur <Link href={`/${page.slug}`} target="_blank" className="text-brand hover:underline">/{page.slug}</Link>
      </p>

      <PageEditForm page={{ id: page.id, title: page.title, contentHtml: page.contentHtml }} />
    </div>
  );
}
