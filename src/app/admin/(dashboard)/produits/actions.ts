'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdminUser } from '@/lib/supabase-server';

export async function updateProduct(
  productId: string,
  data: {
    title: string;
    price: number;
    stockQty: number | null;
    inStock: boolean;
    shortDescription: string;
    description: string;
    metaTitle: string;
    metaDescription: string;
    images: string[];
  }
) {
  await requireAdminUser();

  await prisma.product.update({
    where: { id: productId },
    data: {
      title: data.title,
      price: data.price,
      stockQty: data.stockQty,
      inStock: data.inStock,
      shortDescription: data.shortDescription || null,
      description: data.description || null,
      metaTitle: data.metaTitle || null,
      metaDescription: data.metaDescription || null,
      images: data.images,
      imageUrl: data.images[0] ?? null,
    },
  });

  revalidatePath('/admin/produits');
  revalidatePath(`/admin/produits/${productId}`);
  revalidatePath('/boutique');
  revalidatePath('/');
}


export async function toggleStock(productId: string, inStock: boolean) {
  await requireAdminUser();
  await prisma.product.update({ where: { id: productId }, data: { inStock } });
  revalidatePath('/admin/produits');
  revalidatePath('/boutique');
}
