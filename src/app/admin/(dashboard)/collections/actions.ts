'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireAdminUser } from '@/lib/supabase-server';

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

export async function createCollection(name: string) {
  await requireAdminUser();
  if (!name.trim()) return { error: 'Le nom est obligatoire.' };

  const baseSlug = slugify(name);
  let slug = baseSlug;
  let i = 1;
  while (await prisma.collection.findUnique({ where: { slug } })) {
    i += 1;
    slug = `${baseSlug}-${i}`;
  }

  const collection = await prisma.collection.create({ data: { name: name.trim(), slug } });
  revalidatePath('/admin/collections');
  redirect(`/admin/collections/${collection.id}`);
}

export async function renameCollection(id: string, name: string) {
  await requireAdminUser();
  if (!name.trim()) return { error: 'Le nom est obligatoire.' };
  await prisma.collection.update({ where: { id }, data: { name: name.trim() } });
  revalidatePath('/admin/collections');
  revalidatePath(`/admin/collections/${id}`);
  return { ok: true };
}

export async function deleteCollection(id: string) {
  await requireAdminUser();
  await prisma.collection.delete({ where: { id } });
  revalidatePath('/admin/collections');
  redirect('/admin/collections');
}

export async function setCollectionModels(id: string, modelIds: string[]) {
  await requireAdminUser();

  const products = await prisma.product.findMany({
    where: {
      modelId: {
        in: modelIds,
      },
    },
    select: {
      id: true,
    },
  });

  const productIds = products.map((product) => product.id);

  await prisma.collection.update({
    where: { id },
    data: { productIds },
  });

  revalidatePath('/admin/collections');
  revalidatePath(`/admin/collections/${id}`);
  revalidatePath('/collection');
  revalidatePath('/boutique');
  revalidatePath('/');

  return { ok: true };
}

export async function setCollectionProducts(id: string, productIds: string[]) {
  await requireAdminUser();
  await prisma.collection.update({ where: { id }, data: { productIds } });
  revalidatePath('/admin/collections');
  revalidatePath(`/admin/collections/${id}`);
  revalidatePath('/collection');
  return { ok: true };
}

export async function setProductsShowInBoutique(productIds: string[], show: boolean) {
  await requireAdminUser();
  await prisma.product.updateMany({ where: { id: { in: productIds } }, data: { showInBoutique: show } });
  revalidatePath('/admin/collections');
  revalidatePath('/boutique');
  revalidatePath('/');
  return { ok: true };
}