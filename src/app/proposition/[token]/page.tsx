import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { formatPrice } from '@/lib/format';
import { parisToday } from '@/lib/seasonalThemes';
import { isExpired, isToken, itemsTotal, laborTotal, loadProposal, round2 } from '@/lib/proposal';
import ProposalCta from './ProposalCta';

// Lien privé envoyé par e-mail : jamais indexé, toujours recalculé (prix et stock du moment).
export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Votre proposition | ReparMonPhone',
  robots: { index: false, follow: false },
};

const dateFr = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}/${ymd.slice(0, 4)}`;

export default async function ProposalPage({ params }: { params: { token: string } }) {
  if (!isToken(params.token)) notFound();
  const proposal = await loadProposal(params.token);
  if (!proposal) notFound();

  const products = proposal.items.length
    ? await prisma.product.findMany({
        where: { id: { in: proposal.items.map((i) => i.productId) } },
        select: { id: true, slug: true, title: true, price: true, imageUrl: true, inStock: true },
      })
    : [];

  // Prix et stock d'aujourd'hui : on ne vend jamais au prix d'hier si le catalogue a changé.
  const lines = proposal.items.map((i) => {
    const p = products.find((x) => x.id === i.productId);
    const available = !!p && p.inStock !== false;
    const price = p ? round2(Number(p.price)) : i.price;
    return {
      productId: i.productId,
      slug: p?.slug ?? i.slug,
      title: p?.title ?? i.title,
      imageUrl: p?.imageUrl ?? i.imageUrl,
      quantity: i.quantity,
      price,
      proposedPrice: i.price,
      available,
      priceChanged: available && Math.round(price * 100) !== Math.round(i.price * 100),
    };
  });
  const orderable = lines.filter((l) => l.available);
  const expired = isExpired(proposal, parisToday());
  const parts = itemsTotal(orderable);
  const labor = laborTotal(proposal.labor);
  const anyUnavailable = lines.some((l) => !l.available);
  const anyChanged = lines.some((l) => l.priceChanged);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-sm font-semibold uppercase tracking-wide text-brand">ReparMonPhone</p>
      <h1 className="mt-1 text-3xl font-bold text-gray-900">
        {proposal.customerName ? `Votre proposition, ${proposal.customerName}` : 'Votre proposition'}
      </h1>
      <p className="mt-2 text-gray-600">
        {expired ? (
          <>Cette proposition a expiré le {dateFr(proposal.validUntil)}. Contactez-nous pour obtenir une proposition à jour.</>
        ) : (
          <>Valable jusqu’au {dateFr(proposal.validUntil)}.</>
        )}
      </p>

      {proposal.message && (
        <div className="mt-6 whitespace-pre-line rounded-xl border-l-4 border-brand bg-brand-light/50 px-4 py-3 text-sm leading-relaxed text-gray-800">
          {proposal.message}
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        {lines.length > 0 && (
          <>
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">Pièces</h2>
            <ul className="mt-2 divide-y divide-gray-100">
              {lines.map((l) => (
                <li key={l.productId} className="flex items-center gap-3 py-3">
                  {l.imageUrl ? (
                    <Image src={l.imageUrl} alt="" width={56} height={56} className="h-14 w-14 shrink-0 rounded-lg border border-gray-100 object-contain" />
                  ) : (
                    <div className="h-14 w-14 shrink-0 rounded-lg bg-gray-100" />
                  )}
                  <div className="min-w-0 flex-1">
                    {l.available ? (
                      <Link href={`/produit/${l.slug}`} className="text-sm font-medium text-gray-900 hover:text-brand">
                        {l.title}
                      </Link>
                    ) : (
                      <span className="text-sm font-medium text-gray-400 line-through">{l.title}</span>
                    )}
                    <div className="text-xs text-gray-500">
                      Quantité : {l.quantity}
                      {!l.available && <span className="ml-2 font-semibold text-orange-600">Plus disponible actuellement</span>}
                      {l.priceChanged && (
                        <span className="ml-2 font-semibold text-orange-600">
                          Prix mis à jour ({formatPrice(l.proposedPrice)} → {formatPrice(l.price)})
                        </span>
                      )}
                    </div>
                  </div>
                  <div className={`shrink-0 text-sm font-semibold tabular-nums ${l.available ? 'text-gray-900' : 'text-gray-300 line-through'}`}>
                    {formatPrice(l.price * l.quantity)}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        {proposal.labor.length > 0 && (
          <>
            <h2 className={`text-xs font-bold uppercase tracking-wider text-gray-500 ${lines.length > 0 ? 'mt-5' : ''}`}>Main d’œuvre</h2>
            <ul className="mt-2 divide-y divide-gray-100">
              {proposal.labor.map((l, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span className="text-gray-900">{l.label}</span>
                  <span className="shrink-0 font-semibold tabular-nums">{formatPrice(l.price)}</span>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="mt-4 flex items-baseline justify-between border-t border-gray-100 pt-4">
          <span className="text-base font-bold text-gray-900">Total TTC</span>
          <span className="text-2xl font-extrabold text-brand-dark">{formatPrice(round2(parts + labor))}</span>
        </div>
        {lines.length > 0 && proposal.labor.length > 0 && (
          <p className="mt-1 text-right text-xs text-gray-500">
            dont pièces {formatPrice(parts)} et main d’œuvre {formatPrice(labor)}
          </p>
        )}
      </div>

      {(anyUnavailable || anyChanged) && !expired && (
        <p className="mt-4 rounded-lg bg-orange-50 px-4 py-3 text-sm text-orange-800">
          Certaines lignes ont changé depuis l’envoi de cette proposition ; le total ci-dessus tient compte des produits disponibles et des prix actuels.
          Contactez-nous si vous souhaitez un autre produit équivalent.
        </p>
      )}

      <div className="mt-6">
        <ProposalCta
          token={proposal.token}
          lines={orderable.map(({ productId, slug, title, price, imageUrl, quantity }) => ({ productId, slug, title, price, imageUrl, quantity }))}
          hasLabor={proposal.labor.length > 0}
          expired={expired}
        />
      </div>

      <ul className="mt-6 space-y-1 text-xs leading-relaxed text-gray-500">
        {lines.length > 0 && <li>Les frais de port sont calculés dans le panier selon le mode de livraison choisi.</li>}
        {proposal.labor.length > 0 && <li>La main d’œuvre se règle lors de la réparation ; elle n’est pas payable en ligne.</li>}
        <li>Prix TTC. Une question ? Écrivez-nous à contact@reparmonphone.fr ou répondez au mail reçu.</li>
      </ul>
    </div>
  );
}
