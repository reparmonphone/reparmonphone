'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdminUser } from '@/lib/supabase-server';

export async function toggleMessageHandled(messageId: string, handled: boolean) {
  await requireAdminUser();
  await prisma.contactMessage.update({ where: { id: messageId }, data: { handled } });
  revalidatePath('/admin/messages');
}
