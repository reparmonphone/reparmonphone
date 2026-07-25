'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdminUser } from '@/lib/supabase-server';
import type { OrderStatus } from '@prisma/client';

export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  await requireAdminUser();
  await prisma.order.update({ where: { id: orderId }, data: { status } });
  revalidatePath('/admin/commandes');
  revalidatePath(`/admin/commandes/${orderId}`);
}
