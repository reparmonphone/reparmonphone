'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireAdminUser } from '@/lib/supabase-server';
import { pingIndexNow } from '@/lib/indexnow';

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

async function uniqueProductSlug(title: string) {
  const base = slugify(title) || 'produit';
  let slug = base;
  let i = 1;
  while (await prisma.product.findUnique({ where: { slug } })) {
    i += 1;
    slug = `${base}-${i}`;
  }
  return slug;
}

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
    modelId: string;
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
      modelId: data.modelId,
    },
  });

  revalidatePath('/admin/produits');
  revalidatePath(`/admin/produits/${productId}`);
  revalidatePath('/boutique');
  revalidatePath('/');

  const updated = await prisma.product.findUnique({ where: { id: productId }, select: { slug: true } });
  if (updated) {
    pingIndexNow([`${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.reparmonphone.fr'}/produit/${updated.slug}`]);
  }
}

// Suppression définitive d'un produit. Bloquée par la base elle-même (contrainte de clé étrangère,
// voir prisma/schema.prisma) si ce produit fait partie d'une commande déjà passée — on ne veut
// jamais perdre l'historique des ventes. Dans ce cas on renvoie un message clair plutôt que de
// planter : le produit doit être mis en rupture de stock / masqué plutôt que supprimé.
export async function deleteProduct(productId: string) {
  await requireAdminUser();
  try {
    await prisma.product.delete({ where: { id: productId } });
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === 'P2003') {
      return {
        error:
          "Impossible de supprimer : ce produit fait partie d'au moins une commande déjà passée. " +
          'Mets-le en rupture de stock ou masque-le plutôt, pour garder l\'historique des ventes intact.',
      };
    }
    return { error: 'Erreur inattendue lors de la suppression.' };
  }
  revalidatePath('/admin/produits');
  revalidatePath('/boutique');
  revalidatePath('/');
  return { ok: true };
}

export async function toggleStock(productId: string, inStock: boolean) {
  await requireAdminUser();
  await prisma.product.update({ where: { id: productId }, data: { inStock } });
  revalidatePath('/admin/produits');
  revalidatePath('/boutique');
}

// Modification rapide du prix depuis la liste (sans ouvrir la fiche complète)
export async function updateProductPrice(productId: string, price: number) {
  await requireAdminUser();
  if (!Number.isFinite(price) || price < 0) {
    return { error: 'Prix invalide.' };
  }
  await prisma.product.update({ where: { id: productId }, data: { price } });
  revalidatePath('/admin/produits');
  revalidatePath('/boutique');
  return { ok: true };
}

// Réaffectation rapide depuis la liste (sans ouvrir la fiche complète)
export async function updateProductModel(productId: string, modelId: string) {
  await requireAdminUser();
  await prisma.product.update({ where: { id: productId }, data: { modelId } });
  revalidatePath('/admin/produits');
  revalidatePath('/boutique');
  revalidatePath('/');
}

export async function createProduct(data: {
  title: string;
  price: number;
  stockQty: number | null;
  inStock: boolean;
  shortDescription: string;
  description: string;
  metaTitle: string;
  metaDescription: string;
  images: string[];
  brandId?: string;
  newBrandName?: string;
  productLineId?: string;
  newLineName?: string;
  modelId?: string;
  newModelName?: string;
}) {
  await requireAdminUser();

  if (!data.title.trim()) {
    return { error: 'Le titre du produit est obligatoire.' };
  }

  let brandId = data.brandId;
  if (data.newBrandName?.trim()) {
    const name = data.newBrandName.trim();
    const brand = await prisma.brand.upsert({
      where: { name },
      update: {},
      create: { name, slug: slugify(name) },
    });
    brandId = brand.id;
  }
  if (!brandId) return { error: 'Sélectionne ou crée une marque.' };

  let productLineId = data.productLineId;
  if (data.newLineName?.trim()) {
    const name = data.newLineName.trim();
    const slug = slugify(name);
    const line = await prisma.productLine.upsert({
      where: { brandId_slug: { brandId, slug } },
      update: {},
      create: { name, slug, brandId },
    });
    productLineId = line.id;
  }
  if (!productLineId) return { error: 'Sélectionne ou crée une gamme.' };

  let modelId = data.modelId;
  if (data.newModelName?.trim()) {
    const name = data.newModelName.trim();
    const slug = slugify(name);
    const model = await prisma.model.upsert({
      where: { productLineId_slug: { productLineId, slug } },
      update: {},
      create: { name, slug, productLineId },
    });
    modelId = model.id;
  }
  if (!modelId) return { error: 'Sélectionne ou crée un modèle.' };

  const slug = await uniqueProductSlug(data.title);

  const product = await prisma.product.create({
    data: {
      title: data.title.trim(),
      slug,
      price: data.price,
      stockQty: data.stockQty,
      inStock: data.inStock,
      shortDescription: data.shortDescription || null,
      description: data.description || null,
      metaTitle: data.metaTitle || null,
      metaDescription: data.metaDescription || null,
      images: data.images,
      imageUrl: data.images[0] ?? null,
      modelId,
    },
  });

  revalidatePath('/admin/produits');
  revalidatePath('/boutique');
  revalidatePath('/');
  pingIndexNow([`${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.reparmonphone.fr'}/produit/${product.slug}`]);
  redirect(`/admin/produits/${product.id}`);
}
