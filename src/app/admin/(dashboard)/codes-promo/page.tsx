import { prisma } from '@/lib/prisma';
import PromoCodesList from './PromoCodesList';

export default async function AdminCodesPromoPage() {
  const codes = await prisma.promoCode.findMany({ orderBy: { createdAt: 'desc' } });

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-1">Codes promo</h1>
      <p className="text-gray-500 mb-6">
        Créés ici, utilisables par les clients directement sur la page panier.
      </p>

      <PromoCodesList
        codes={codes.map((c) => ({
          id: c.id,
          code: c.code,
          type: c.type,
          value: Number(c.value),
          active: c.active,
          expiresAt: c.expiresAt ? c.expiresAt.toISOString().slice(0, 10) : '',
          maxUses: c.maxUses,
          usedCount: c.usedCount,
        }))}
      />
    </div>
  );
}
