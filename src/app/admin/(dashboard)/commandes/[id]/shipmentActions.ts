'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdminUser } from '@/lib/supabase-server';
import { sendShipmentTrackingEmail } from '@/lib/orderEmails';
import type { ShippingCarrier } from '@prisma/client';

// Crée un nouvel envoi (colis) pour une commande, avec les articles + quantités qu'il contient.
// items : liste des { orderItemId, quantity } inclus dans CET envoi — la quantité doit être
// comprise entre 1 et la quantité restant à expédier pour cet article (vérifié ci-dessous).
export async function createShipment(
  orderId: string,
  data: {
    carrier: ShippingCarrier | null;
    trackingNumber: string;
    trackingUrlOverride: string;
    items: { orderItemId: string; quantity: number }[];
  }
) {
  await requireAdminUser();

  const validEntries = data.items.filter((i) => i.quantity > 0);
  if (validEntries.length === 0) {
    return { error: 'Sélectionnez au moins un article à inclure dans cet envoi.' };
  }

  // Sécurité : on vérifie que chaque article appartient bien à cette commande, et que la quantité
  // demandée ne dépasse pas ce qu'il reste réellement à expédier pour cet article (commande déjà
  // partiellement expédiée comprise).
  const orderItems = await prisma.orderItem.findMany({
    where: { orderId },
    include: { shipmentItems: true },
  });
  const byId = new Map(orderItems.map((oi) => [oi.id, oi]));

  for (const entry of validEntries) {
    const orderItem = byId.get(entry.orderItemId);
    if (!orderItem) {
      return { error: "Un article sélectionné n'appartient pas à cette commande." };
    }
    const alreadyShipped = orderItem.shipmentItems.reduce((sum, si) => sum + si.quantity, 0);
    const remaining = orderItem.quantity - alreadyShipped;
    if (entry.quantity > remaining) {
      return { error: `Quantité trop élevée pour un article (il ne reste que ${remaining} unité(s) à expédier).` };
    }
  }

  const shipment = await prisma.shipment.create({
    data: {
      orderId,
      carrier: data.carrier,
      trackingNumber: data.trackingNumber || null,
      trackingUrlOverride: data.trackingUrlOverride || null,
      items: {
        create: validEntries.map((e) => ({ orderItemId: e.orderItemId, quantity: e.quantity })),
      },
    },
  });

  if (shipment.trackingNumber) {
    await sendShipmentTrackingEmail(shipment.id);
  }

  revalidatePath(`/admin/commandes/${orderId}`);
  revalidatePath('/compte/commandes');
  revalidatePath(`/compte/commandes/${orderId}`);
  return { ok: true };
}

// Met à jour le transporteur / numéro de suivi d'un envoi déjà créé (la répartition des articles,
// elle, ne se modifie pas après coup — il faut supprimer l'envoi et le recréer si besoin).
export async function updateShipmentTracking(
  shipmentId: string,
  data: { carrier: ShippingCarrier | null; trackingNumber: string; trackingUrlOverride: string }
) {
  await requireAdminUser();

  const existing = await prisma.shipment.findUnique({ where: { id: shipmentId } });
  if (!existing) return { error: 'Envoi introuvable.' };

  const newTrackingNumber = data.trackingNumber || null;
  const shouldNotify = !!newTrackingNumber && newTrackingNumber !== existing.trackingNumber;

  await prisma.shipment.update({
    where: { id: shipmentId },
    data: {
      carrier: data.carrier,
      trackingNumber: newTrackingNumber,
      trackingUrlOverride: data.trackingUrlOverride || null,
    },
  });

  if (shouldNotify) {
    await sendShipmentTrackingEmail(shipmentId);
  }

  revalidatePath(`/admin/commandes/${existing.orderId}`);
  revalidatePath('/compte/commandes');
  revalidatePath(`/compte/commandes/${existing.orderId}`);
  return { ok: true };
}

export async function deleteShipment(shipmentId: string) {
  await requireAdminUser();

  const existing = await prisma.shipment.findUnique({ where: { id: shipmentId } });
  if (!existing) return { error: 'Envoi introuvable.' };

  await prisma.shipment.delete({ where: { id: shipmentId } });

  revalidatePath(`/admin/commandes/${existing.orderId}`);
  revalidatePath('/compte/commandes');
  revalidatePath(`/compte/commandes/${existing.orderId}`);
  return { ok: true };
}
