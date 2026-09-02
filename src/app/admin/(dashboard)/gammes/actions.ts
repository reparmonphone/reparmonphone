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

// Place une gamme en dernière position (sortOrder le plus grand + 1) dans la marque donnée —
// même logique que nextSortOrder ci-dessous pour les modèles, pour ne jamais entrer en collision
// avec l'ordre manuel déjà réglé par l'utilisateur (voir reorderLines).
async function nextLineSortOrder(brandId: string): Promise<number> {
  const last = await prisma.productLine.findFirst({ where: { brandId }, orderBy: { sortOrder: 'desc' } });
  return (last?.sortOrder ?? -1) + 1;
}

export async function createLine(brandId: string, name: string) {
  await requireAdminUser();
  if (!name.trim()) return { error: 'Le nom ne peut pas être vide.' };
  const slug = slugify(name);
  const existing = await prisma.productLine.findUnique({ where: { brandId_slug: { brandId, slug } } });
  if (existing) return { error: 'Une gamme avec ce nom existe déjà pour cette marque.' };
  const sortOrder = await nextLineSortOrder(brandId);
  await prisma.productLine.create({ data: { name: name.trim(), slug, brandId, sortOrder } });
  revalidateAll();
  return { ok: true };
}

// Réordonne en une seule fois toutes les gammes d'une marque : reçoit la liste complète des ids
// dans le nouvel ordre voulu (tel que reconstruit côté client après un glisser-déposer) et
// réécrit sortOrder = 0, 1, 2... en conséquence.
export async function reorderLines(brandId: string, orderedLineIds: string[]) {
  await requireAdminUser();
  await prisma.$transaction(
    orderedLineIds.map((id, index) =>
      prisma.productLine.update({ where: { id, brandId }, data: { sortOrder: index } })
    )
  );
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

// Met à jour l'image "alternative" d'une gamme, utilisée uniquement quand cette gamme apparaît une
// deuxième fois ailleurs sur le site (ex: "iPad" à la fois sur /marque/apple et dans la page des 4
// catégories iPad) — voir hubImageUrl dans prisma/schema.prisma. Même mécanique d'upload que
// updateLineImage ci-dessus.
export async function updateLineHubImage(lineId: string, imageUrl: string) {
  await requireAdminUser();
  if (!imageUrl.trim()) return { error: 'URL d\'image invalide.' };
  await prisma.productLine.update({ where: { id: lineId }, data: { hubImageUrl: imageUrl.trim() } });
  revalidateAll();
  return { ok: true };
}

// Efface l'image alternative : la gamme réutilise alors la même image partout (comportement par défaut).
export async function clearLineHubImage(lineId: string) {
  await requireAdminUser();
  await prisma.productLine.update({ where: { id: lineId }, data: { hubImageUrl: null } });
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

// Place un modèle en dernière position (sortOrder le plus grand + 1) dans la gamme donnée —
// utilisé à la création d'un modèle et quand on le déplace vers une autre gamme, pour ne jamais
// entrer en collision avec l'ordre manuel déjà réglé par l'utilisateur (voir reorderModels).
async function nextSortOrder(lineId: string): Promise<number> {
  const last = await prisma.model.findFirst({ where: { productLineId: lineId }, orderBy: { sortOrder: 'desc' } });
  return (last?.sortOrder ?? -1) + 1;
}

export async function createModel(lineId: string, name: string) {
  await requireAdminUser();
  if (!name.trim()) return { error: 'Le nom ne peut pas être vide.' };
  const slug = slugify(name);
  const existing = await prisma.model.findUnique({ where: { productLineId_slug: { productLineId: lineId, slug } } });
  if (existing) return { error: 'Un modèle avec ce nom existe déjà dans cette gamme.' };
  const sortOrder = await nextSortOrder(lineId);
  await prisma.model.create({ data: { name: name.trim(), slug, productLineId: lineId, sortOrder } });
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

// Met à jour l'image de carte d'un modèle (affichée sur /marque/[marque]/[gamme]). L'upload du
// fichier se fait avant, côté client, via /api/admin/upload-line-image (route générique, pas
// spécifique aux gammes malgré son nom) — cette action ne fait qu'enregistrer l'URL Supabase obtenue.
export async function updateModelImage(modelId: string, imageUrl: string) {
  await requireAdminUser();
  if (!imageUrl.trim()) return { error: 'URL d\'image invalide.' };
  await prisma.model.update({ where: { id: modelId }, data: { imageUrl: imageUrl.trim() } });
  revalidateAll();
  return { ok: true };
}

// Inclut ou retire un modèle du tirage aléatoire "Vedette" de la page d'accueil (voir
// Model.featuredOnHome dans le schéma, et TopProduitsSection.tsx pour la logique de tirage/repli).
export async function toggleModelFeatured(modelId: string, featured: boolean) {
  await requireAdminUser();
  await prisma.model.update({ where: { id: modelId }, data: { featuredOnHome: featured } });
  revalidateAll();
  return { ok: true };
}

// Déplace un modèle (et donc tous ses produits) vers une autre gamme, éventuellement d'une autre marque.
// Placé en dernière position de la gamme d'arrivée (voir nextSortOrder) : son ancien sortOrder n'a
// aucun sens dans la nouvelle gamme et pourrait entrer en collision avec un modèle qui y est déjà.
export async function moveModel(modelId: string, newLineId: string) {
  await requireAdminUser();
  const sortOrder = await nextSortOrder(newLineId);
  await prisma.model.update({ where: { id: modelId }, data: { productLineId: newLineId, sortOrder } });
  revalidateAll();
  return { ok: true };
}

// Réordonne en une seule fois tous les modèles d'une gamme : reçoit la liste complète des ids
// dans le nouvel ordre voulu (tel que reconstruit côté client après un glisser-déposer) et
// réécrit sortOrder = 0, 1, 2... en conséquence. Remplace l'ancien système de flèches ▲▼.
export async function reorderModels(lineId: string, orderedModelIds: string[]) {
  await requireAdminUser();
  await prisma.$transaction(
    orderedModelIds.map((id, index) =>
      prisma.model.update({ where: { id, productLineId: lineId }, data: { sortOrder: index } })
    )
  );
  revalidateAll();
  return { ok: true };
}

// Déplace une gamme entière (et donc toutes ses modèles/produits) vers une autre marque. Placée en
// dernière position de la marque d'arrivée (voir nextLineSortOrder) : son ancien sortOrder n'a
// aucun sens dans la nouvelle marque et pourrait entrer en collision avec une gamme qui y est déjà.
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
    const sortOrder = await nextLineSortOrder(newBrandId);
    await prisma.productLine.update({ where: { id: lineId }, data: { brandId: newBrandId, sortOrder } });
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
