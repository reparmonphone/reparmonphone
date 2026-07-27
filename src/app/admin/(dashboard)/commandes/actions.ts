'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdminUser } from '@/lib/supabase-server';
import { sendPendingOrderReminder } from '@/lib/orderReminder';
import { sendReviewReminder } from '@/lib/reviewReminder';
import type { OrderStatus, ShippingCarrier } from '@prisma/client';

export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  await requireAdminUser();
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  await prisma.order.update({
    where: { id: orderId },
    data: {
      status,
      // On mémorise la date de livraison seulement la première fois (pas si le statut est modifié plusieurs fois)
      deliveredAt: status === 'DELIVERED' && !order?.deliveredAt ? new Date() : undefined,
    },
  });
  revalidatePath('/admin/commandes');
  revalidatePath(`/admin/commandes/${orderId}`);
}

export async function updateOrderTracking(
  orderId: string,
  data: { carrier: ShippingCarrier | null; trackingNumber: string; trackingUrlOverride: string }
) {
  await requireAdminUser();
  await prisma.order.update({
    where: { id: orderId },
    data: {
      carrier: data.carrier,
      trackingNumber: data.trackingNumber || null,
      trackingUrlOverride: data.trackingUrlOverride || null,
    },
  });
  revalidatePath('/admin/commandes');
  revalidatePath(`/admin/commandes/${orderId}`);
  revalidatePath('/compte/commandes');
}

export async function sendReminderManually(orderId: string) {
  await requireAdminUser();
  const result = await sendPendingOrderReminder(orderId);
  revalidatePath('/admin/commandes');
  return result;
}

export async function sendReviewReminderManually(orderId: string) {
  await requireAdminUser();
  const result = await sendReviewReminder(orderId);
  revalidatePath('/admin/commandes');
  revalidatePath(`/admin/commandes/${orderId}`);
  return result;
}

export async function deleteOrder(orderId: string) {
  await requireAdminUser();
  await prisma.orderItem.deleteMany({ where: { orderId } });
  await prisma.order.delete({ where: { id: orderId } });
  revalidatePath('/admin/commandes');
  return { ok: true };
}
