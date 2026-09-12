'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdminUser } from '@/lib/supabase-server';
import { runSupplierComparison, SupplierCheckSummary } from '@/lib/supplierCheck';

// Lancée par le bouton "Lancer la vérification" de /admin/fournisseur (voir
// SupplierCsvUploadForm.tsx) : fait exactement ce que fait scripts/weekly-fournisseur-check.js en
// ligne de commande, mais directement depuis un CSV déposé dans le navigateur — plus besoin
// d'ouvrir PowerShell chaque semaine. Le fichier n'est jamais enregistré sur le serveur, juste lu
// en mémoire le temps de la comparaison.
export async function runSupplierCheckAction(formData: FormData): Promise<{ ok: true; summary: SupplierCheckSummary } | { error: string }> {
  await requireAdminUser();

  const file = formData.get('csv');
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Aucun fichier CSV reçu.' };
  }
  if (file.size > 25 * 1024 * 1024) {
    return { error: 'Fichier trop volumineux (max 25 Mo).' };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const summary = await runSupplierComparison(buffer, file.name);
    revalidatePath('/admin/fournisseur');
    revalidatePath('/admin/produits');
    return { ok: true, summary };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erreur inconnue pendant la vérification.';
    return { error: message };
  }
}

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
