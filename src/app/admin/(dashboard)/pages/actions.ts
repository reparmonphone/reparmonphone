'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdminUser } from '@/lib/supabase-server';

export async function updatePage(id: string, data: { title: string; contentHtml: string }) {
  await requireAdminUser();
  const page = await prisma.page.update({ where: { id }, data });
  revalidatePath('/admin/pages');
  revalidatePath(`/${page.slug}`);
}
