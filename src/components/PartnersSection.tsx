import Image from 'next/image';
import { prisma } from '@/lib/prisma';

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
          <div className="flex flex-nowrap justify-center items-center gap-6 overflow-x-auto pb-2">
            {partners.map((p) => (
              <a
                key={p.id}
                href={p.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 w-[300px] h-[300px] bg-white border border-gray-100 rounded-xl p-8 flex items-center justify-center hover:shadow-md transition"
              >
                {p.logoUrl ? (
                  <div className="relative w-full h-full">
                    <Image src={p.logoUrl} alt={p.name} fill className="object-contain" sizes="300px" />
                  </div>
                ) : (
                  <span className="font-extrabold text-gray-800 text-lg">{p.name}</span>
                )}
              </a>
            ))}
          </div>
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
