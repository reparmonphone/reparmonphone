'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdminUser } from '@/lib/supabase-server';

// Une baisse de prix fournisseur n'est JAMAIS appliquée automatiquement (voir
// scripts/weekly-fournisseur-check.js) — c'est Krys qui décide ici, produit par produit, si elle
// répercute la baisse sur son prix public ou si elle garde son prix actuel (marge conservée).

export async function applyPriceDecrease(itemId: string) {
  await requireAdminUser();

  const item = await prisma.supplierCheckItem.findUnique({ where: { id: itemId } });
  if (!item) return { error: 'Ligne introuvable.' };
  if (item.type !== 'PRIX_BAISSE') return { error: 'Cette ligne n\'est pas une baisse de prix.' };
  if (item.reviewed) return { error: 'Déjà traitée.' };
  if (item.oldSupplierPrice == null || item.newSupplierPrice == null) {
    return { error: 'Prix fournisseur manquant sur cette ligne.' };
  }

  const product = await prisma.product.findUnique({ where: { id: item.productId }, select: { price: true } });
  if (!product) return { error: 'Produit introuvable.' };

  const delta = Number(item.newSupplierPrice) - Number(item.oldSupplierPrice); // négatif
  const newPrice = Math.round((Number(product.price) + delta) * 100) / 100;

  await prisma.$transaction([
    prisma.product.update({ where: { id: item.productId }, data: { price: newPrice } }),
    prisma.supplierCheckItem.update({
      where: { id: itemId },
      data: { applied: true, reviewed: true, newPrice },
    }),
  ]);

  revalidatePath('/admin/fournisseur');
  revalidatePath('/admin/produits');
  return { ok: true, newPrice };
}

export async function ignorePriceDecrease(itemId: string) {
  await requireAdminUser();

  const item = await prisma.supplierCheckItem.findUnique({ where: { id: itemId } });
  if (!item) return { error: 'Ligne introuvable.' };
  if (item.type !== 'PRIX_BAISSE') return { error: 'Cette ligne n\'est pas une baisse de prix.' };
  if (item.reviewed) return { error: 'Déjà traitée.' };

  await prisma.supplierCheckItem.update({ where: { id: itemId }, data: { reviewed: true } });

  revalidatePath('/admin/fournisseur');
  return { ok: true };
}
