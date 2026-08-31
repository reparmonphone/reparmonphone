import { prisma } from '@/lib/prisma';
import PartnersCarousel from './PartnersCarousel';

export default async function PartnersSection() {
  const [partners, referralLinks] = await Promise.all([
    prisma.partner.findMany({ orderBy: { order: 'asc' } }),
    prisma.referralLink.findMany({ orderBy: { order: 'asc' } }),
  ]);

  if (partners.length === 0 && referralLinks.length === 0) return null;

  return (
    <section className="max-w-6xl mx-auto px-4 py-12 text-center">
      {partners.length > 0 && (
        <>
          <h2 className="text-2xl font-extrabold text-gray-900 mb-8">Partenaires</h2>
          <PartnersCarousel
            partners={partners.map((p) => ({ id: p.id, name: p.name, logoUrl: p.logoUrl, linkUrl: p.linkUrl }))}
          />
        </>
      )}

      {referralLinks.length > 0 && (
        <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
          {referralLinks.map((l) => (
            <a
              key={l.id}
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-brand hover:underline"
            >
              {l.label}
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
