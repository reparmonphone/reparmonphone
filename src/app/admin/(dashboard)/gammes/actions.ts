'use server';

import { revalidatePath } from 'next/cache';
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

function revalidateAll() {
  revalidatePath('/admin/gammes');
  revalidatePath('/admin/produits');
  revalidatePath('/boutique');
  revalidatePath('/marque', 'layout');
  revalidatePath('/', 'layout');
}

export async function renameBrand(brandId: string, name: string) {
  await requireAdminUser();
  if (!name.trim()) return { error: 'Le nom ne peut pas être vide.' };
  await prisma.brand.update({ where: { id: brandId }, data: { name: name.trim() } });
  revalidateAll();
  return { ok: true };
}

export async function updateBrandSlug(brandId: string, slugInput: string) {
  await requireAdminUser();
  const slug = slugify(slugInput);
  if (!slug) return { error: 'Slug invalide.' };

  const existing = await prisma.brand.findUnique({ where: { slug } });
  if (existing && existing.id !== brandId) {
    return { error: `Le slug "${slug}" est déjà utilisé par une autre marque.` };
  }

  await prisma.brand.update({ where: { id: brandId }, data: { slug } });
  revalidateAll();
  return { ok: true };
}

export async function createLine(brandId: string, name: string) {
  await requireAdminUser();
  if (!name.trim()) return { error: 'Le nom ne peut pas être vide.' };
  const slug = slugify(name);
  const existing = await prisma.productLine.findUnique({ where: { brandId_slug: { brandId, slug } } });
  if (existing) return { error: 'Une gamme avec ce nom existe déjà pour cette marque.' };
  await prisma.productLine.create({ data: { name: name.trim(), slug, brandId } });
  revalidateAll();
  return { ok: true };
}

export async function renameLine(lineId: string, name: string) {
  await requireAdminUser();
  if (!name.trim()) return { error: 'Le nom ne peut pas être vide.' };
  await prisma.productLine.update({ where: { id: lineId }, data: { name: name.trim() } });
  revalidateAll();
  return { ok: true };
}

// Met à jour l'image de carte d'une gamme (affichée sur /marque/[marque]). L'upload du fichier
// se fait avant, côté client, via /api/admin/upload-line-image — cette action ne fait qu'enregistrer
// l'URL publique Supabase obtenue.
export async function updateLineImage(lineId: string, imageUrl: string) {
  await requireAdminUser();
  if (!imageUrl.trim()) return { error: 'URL d\'image invalide.' };
  await prisma.productLine.update({ where: { id: lineId }, data: { imageUrl: imageUrl.trim() } });
  revalidateAll();
  return { ok: true };
}

export async function deleteLine(lineId: string) {
  await requireAdminUser();
  const count = await prisma.model.count({ where: { productLineId: lineId } });
  if (count > 0) {
    return { error: `Impossible de supprimer : ${count} modèle(s) encore rattaché(s) à cette gamme. Déplace-les d'abord.` };
  }
  await prisma.productLine.delete({ where: { id: lineId } });
  revalidateAll();
  return { ok: true };
}

export async function renameModel(modelId: string, name: string) {
  await requireAdminUser();
  if (!name.trim()) return { error: 'Le nom ne peut pas être vide.' };
  await prisma.model.update({ where: { id: modelId }, data: { name: name.trim() } });
  revalidateAll();
  return { ok: true };
}

// Déplace un modèle (et donc tous ses produits) vers une autre gamme, éventuellement d'une autre marque.
export async function moveModel(modelId: string, newLineId: string) {
  await requireAdminUser();
  await prisma.model.update({ where: { id: modelId }, data: { productLineId: newLineId } });
  revalidateAll();
  return { ok: true };
}

// Déplace une gamme entière (et donc toutes ses modèles/produits) vers une autre marque.
export async function moveLine(lineId: string, newBrandId: string) {
  await requireAdminUser();
  const slug = (await prisma.productLine.findUnique({ where: { id: lineId } }))?.slug;
  if (!slug) return { error: 'Gamme introuvable.' };

  // Évite un conflit si une gamme du même nom existe déjà dans la marque cible
  const existing = await prisma.productLine.findUnique({ where: { brandId_slug: { brandId: newBrandId, slug } } });
  if (existing && existing.id !== lineId) {
    // Fusionne directement : tous les modèles de la gamme source rejoignent la gamme déjà existante côté cible
    await prisma.model.updateMany({ where: { productLineId: lineId }, data: { productLineId: existing.id } });
    await prisma.productLine.delete({ where: { id: lineId } });
  } else {
    await prisma.productLine.update({ where: { id: lineId }, data: { brandId: newBrandId } });
  }
  revalidateAll();
  return { ok: true };
}

export async function deleteBrand(brandId: string) {
  await requireAdminUser();
  const count = await prisma.productLine.count({ where: { brandId } });
  if (count > 0) {
    return { error: `Impossible de supprimer : ${count} gamme(s) encore rattachée(s) à cette marque. Déplace-les d'abord.` };
  }
  await prisma.brand.delete({ where: { id: brandId } });
  revalidateAll();
  return { ok: true };
}
export async function deleteModel(modelId: string) {
  await requireAdminUser();
  const count = await prisma.product.count({ where: { modelId } });
  if (count > 0) {
    return { error: `Impossible de supprimer : ${count} produit(s) encore rattaché(s) à ce modèle.` };
  }
  await prisma.model.delete({ where: { id: modelId } });
  revalidateAll();
  return { ok: true };
}

// Fusionne un modèle "doublon" (souvent issu d'une mauvaise catégorisation à la migration) dans un
// modèle existant portant le même nom ailleurs : tous les produits sont déplacés, puis le doublon est supprimé.
export async function mergeIntoModel(sourceModelId: string, targetModelId: string) {
  await requireAdminUser();
  if (sourceModelId === targetModelId) return { error: 'Modèles identiques.' };

  await prisma.product.updateMany({ where: { modelId: sourceModelId }, data: { modelId: targetModelId } });
  await prisma.model.delete({ where: { id: sourceModelId } });

  revalidateAll();
  return { ok: true };
}
