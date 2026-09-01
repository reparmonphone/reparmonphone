import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { prisma } from '@/lib/prisma';
import JsonLd from '@/components/JsonLd';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.reparmonphone.fr';

const DIFFICULTY_LABEL: Record<string, { label: string; className: string }> = {
  FACILE: { label: 'Facile', className: 'bg-green-100 text-green-700' },
  MOYEN: { label: 'Moyen', className: 'bg-amber-100 text-amber-700' },
  DIFFICILE: { label: 'Difficile', className: 'bg-red-100 text-red-700' },
};

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const guide = await prisma.repairGuide.findUnique({ where: { slug: params.slug } });
  if (!guide) return {};
  return {
    title: guide.metaTitle || `${guide.title} — Guide`,
    description: guide.metaDescription || guide.excerpt || undefined,
  };
}

export default async function GuideDetailPage({ params }: { params: { slug: string } }) {
  const guide = await prisma.repairGuide.findUnique({
    where: { slug: params.slug },
    include: {
      steps: { orderBy: { order: 'asc' } },
      model: { include: { productLine: { include: { brand: true } } } },
    },
  });

  if (!guide || !guide.published) notFound();

  // Incrémente le compteur de vues sans bloquer l'affichage (pas d'await)
  prisma.repairGuide.update({ where: { id: guide.id }, data: { viewCount: { increment: 1 } } }).catch(() => {});

  const diff = DIFFICULTY_LABEL[guide.difficulty];

  // Produits liés au même modèle, pour proposer directement les pièces nécessaires à l'achat
  const relatedProducts = guide.modelId
    ? await prisma.product.findMany({
        where: { modelId: guide.modelId, showInBoutique: true, inStock: true },
        take: 4,
        orderBy: { title: 'asc' },
      })
    : [];

  const howToSchema = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: guide.title,
    description: guide.excerpt || guide.title,
    ...(guide.estimatedTime ? { totalTime: guide.estimatedTime } : {}),
    step: guide.steps.map((s) => ({
      '@type': 'HowToStep',
      name: s.title,
      text: s.contentHtml.replace(/<[^>]+>/g, ' ').trim(),
      ...(s.imageUrl ? { image: s.imageUrl } : {}),
    })),
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <JsonLd data={howToSchema} />

      <p className="text-sm text-gray-400 mb-2">
        <Link href="/reparation" className="hover:text-brand">Guides de réparation</Link>
        {guide.model && (
          <>
            <span className="mx-1">›</span>
            {guide.model.productLine.brand.name} {guide.model.name}
          </>
        )}
      </p>

      <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">{guide.title}</h1>

      {guide.excerpt && <p className="text-gray-600 mb-4">{guide.excerpt}</p>}

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${diff.className}`}>{diff.label}</span>
        {guide.estimatedTime && <span className="text-sm text-gray-500">⏱ {guide.estimatedTime}</span>}
        <span className="text-sm text-gray-400">👁 {guide.viewCount} vues</span>
      </div>

      {guide.coverImageUrl && (
        <div className="relative aspect-video bg-gray-50 rounded-xl overflow-hidden mb-6">
          <Image src={guide.coverImageUrl} alt={guide.title} fill className="object-contain p-4" unoptimized />
        </div>
      )}

      {(guide.toolsNeeded.length > 0 || guide.partsNeeded.length > 0) && (
        <div className="grid sm:grid-cols-2 gap-4 mb-8">
          {guide.toolsNeeded.length > 0 && (
            <div className="bg-gray-50 rounded-xl p-4">
              <h2 className="font-semibold text-sm text-gray-700 mb-2">🧰 Outils nécessaires</h2>
              <ul className="text-sm text-gray-600 space-y-1">
                {guide.toolsNeeded.map((tool, i) => <li key={i}>• {tool}</li>)}
              </ul>
            </div>
          )}
          {guide.partsNeeded.length > 0 && (
            <div className="bg-gray-50 rounded-xl p-4">
              <h2 className="font-semibold text-sm text-gray-700 mb-2">🔩 Pièces nécessaires</h2>
              <ul className="text-sm text-gray-600 space-y-1">
                {guide.partsNeeded.map((part, i) => <li key={i}>• {part}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {relatedProducts.length > 0 && (
        <div className="bg-brand-light/40 border border-brand/20 rounded-xl p-5 mb-10">
          <h2 className="font-semibold text-gray-800 mb-3">🛒 Pièces disponibles pour ce modèle</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {relatedProducts.map((p) => (
              <Link
                key={p.id}
                href={`/produit/${p.slug}`}
                className="bg-white rounded-lg p-3 text-center hover:shadow-md transition"
              >
                {p.imageUrl && (
                  <img src={p.imageUrl} alt={p.title} className="w-full h-16 object-contain mb-2" />
                )}
                <p className="text-xs text-gray-700 line-clamp-2">{p.title}</p>
                <p className="text-sm font-bold text-brand-dark mt-1">{Number(p.price).toFixed(2)} €</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-10">
        {guide.steps.map((step, index) => (
          <div key={step.id} className="flex gap-4">
            <div className="shrink-0 w-9 h-9 rounded-full bg-brand text-white flex items-center justify-center font-bold text-sm">
              {index + 1}
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg text-gray-900 mb-2">{step.title}</h3>
              {step.imageUrl && (
                <div className="relative aspect-video bg-gray-50 rounded-xl overflow-hidden mb-3 max-w-md">
                  <Image src={step.imageUrl} alt={step.title} fill className="object-contain p-3" unoptimized />
                </div>
              )}
              <p className="text-gray-700 leading-relaxed whitespace-pre-line">{step.contentHtml}</p>
              {step.warning && (
                <div className="mt-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
                  ⚠️ {step.warning}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-12 bg-gray-50 rounded-xl p-6 text-center">
        <p className="text-gray-600 mb-3">Pas envie de le faire vous-même ou besoin d&apos;aide ?</p>
        <Link href="/rdv" className="inline-block bg-brand text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-brand-dark transition">
          Prendre rendez-vous en atelier
        </Link>
      </div>
    </div>
  );
}
