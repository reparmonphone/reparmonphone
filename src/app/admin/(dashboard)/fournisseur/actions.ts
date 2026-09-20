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

// Applique TOUTES les baisses de prix fournisseur en attente d'un coup, au lieu de cliquer
// "Appliquer la baisse" ligne par ligne (utile après une resynchronisation qui a rempli la file
// de plusieurs milliers de lignes d'un coup). Une boucle classique (2 requêtes par ligne) serait
// bien trop lente sur ~4000+ lignes et risquerait le timeout — on fait donc UNE seule requête SQL
// atomique qui reproduit exactement la même formule que applyPriceDecrease ci-dessus
// (nouveau prix = prix public actuel + (nouveau prix fournisseur − ancien prix fournisseur), arrondi
// au centime).
//
// Si un même produit a plusieurs lignes en attente (ex: plusieurs vérifications lancées sans
// jamais valider la file — c'est ce qui a mélangé les lignes de Krys), seule la plus récente est
// réellement appliquée ; les autres sont simplement retirées de la file ("reviewed") sans toucher
// au prix, pour ne pas cumuler plusieurs baisses sur le même produit.
export async function applyAllPendingPriceDecreases() {
  await requireAdminUser();

  const pendingItems = await prisma.supplierCheckItem.findMany({
    where: {
      type: 'PRIX_BAISSE',
      reviewed: false,
      oldSupplierPrice: { not: null },
      newSupplierPrice: { not: null },
    },
    select: { productId: true },
  });

  if (pendingItems.length === 0) {
    return { ok: true, applied: 0, duplicatesCleaned: 0 };
  }

  const uniqueProducts = new Set(pendingItems.map((i) => i.productId)).size;

  await prisma.$executeRaw`
    WITH ranked AS (
      SELECT sci.id, sci."productId",
             ROW_NUMBER() OVER (PARTITION BY sci."productId" ORDER BY sci."createdAt" DESC) AS rn
      FROM supplier_check_items sci
      WHERE sci.type = 'PRIX_BAISSE' AND sci.reviewed = false
        AND sci."oldSupplierPrice" IS NOT NULL AND sci."newSupplierPrice" IS NOT NULL
    ),
    pending AS (
      SELECT r.id AS item_id, r."productId" AS product_id,
             ROUND(p.price + (sci."newSupplierPrice" - sci."oldSupplierPrice"), 2) AS new_price
      FROM ranked r
      JOIN supplier_check_items sci ON sci.id = r.id
      JOIN products p ON p.id = r."productId"
      WHERE r.rn = 1
    ),
    upd_products AS (
      UPDATE products p
      SET price = pending.new_price
      FROM pending
      WHERE p.id = pending.product_id
    ),
    upd_applied AS (
      UPDATE supplier_check_items sci
      SET "newPrice" = pending.new_price, applied = true, reviewed = true
      FROM pending
      WHERE sci.id = pending.item_id
    )
    UPDATE supplier_check_items sci
    SET reviewed = true
    FROM ranked r
    WHERE sci.id = r.id AND r.rn > 1
  `;

  revalidatePath('/admin/fournisseur');
  revalidatePath('/admin/produits');
  return { ok: true, applied: uniqueProducts, duplicatesCleaned: pendingItems.length - uniqueProducts };
}

// Symétrique de applyAllPendingPriceDecreases : garde tous les prix actuels et vide la file
// d'attente d'un coup (aucun impact sur les prix, juste marque toutes les lignes comme traitées).
export async function ignoreAllPendingPriceDecreases() {
  await requireAdminUser();

  const result = await prisma.supplierCheckItem.updateMany({
    where: { type: 'PRIX_BAISSE', reviewed: false },
    data: { reviewed: true },
  });

  revalidatePath('/admin/fournisseur');
  return { ok: true, count: result.count };
}
