'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireAdminUser } from '@/lib/supabase-server';
import type { GuideDifficulty } from '@prisma/client';

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

async function uniqueGuideSlug(title: string) {
  const base = slugify(title) || 'guide';
  let slug = base;
  let i = 1;
  while (await prisma.repairGuide.findUnique({ where: { slug } })) {
    i += 1;
    slug = `${base}-${i}`;
  }
  return slug;
}

export type GuideStepInput = {
  title: string;
  contentHtml: string;
  imageUrl: string;
  warning: string;
};

export type GuideFormData = {
  title: string;
  excerpt: string;
  coverImageUrl: string;
  modelId: string | null;
  difficulty: GuideDifficulty;
  estimatedTime: string;
  toolsNeeded: string[];
  partsNeeded: string[];
  published: boolean;
  metaTitle: string;
  metaDescription: string;
  steps: GuideStepInput[];
};

export async function createGuide(data: GuideFormData) {
  await requireAdminUser();

  if (!data.title.trim()) return { error: 'Le titre est obligatoire.' };
  if (data.steps.length === 0) return { error: 'Ajoute au moins une étape.' };

  const slug = await uniqueGuideSlug(data.title);

  const guide = await prisma.repairGuide.create({
    data: {
      title: data.title.trim(),
      slug,
      excerpt: data.excerpt || null,
      coverImageUrl: data.coverImageUrl || null,
      modelId: data.modelId || null,
      difficulty: data.difficulty,
      estimatedTime: data.estimatedTime || null,
      toolsNeeded: data.toolsNeeded.filter(Boolean),
      partsNeeded: data.partsNeeded.filter(Boolean),
      published: data.published,
      metaTitle: data.metaTitle || null,
      metaDescription: data.metaDescription || null,
      steps: {
        create: data.steps.map((step, index) => ({
          order: index,
          title: step.title,
          contentHtml: step.contentHtml,
          imageUrl: step.imageUrl || null,
          warning: step.warning || null,
        })),
      },
    },
  });

  revalidatePath('/admin/guides');
  revalidatePath('/reparation');
  redirect(`/admin/guides/${guide.id}`);
}

export async function updateGuide(guideId: string, data: GuideFormData) {
  await requireAdminUser();

  if (!data.title.trim()) return { error: 'Le titre est obligatoire.' };
  if (data.steps.length === 0) return { error: 'Ajoute au moins une étape.' };

  const existing = await prisma.repairGuide.findUnique({ where: { id: guideId }, select: { slug: true, title: true } });
  if (!existing) return { error: 'Guide introuvable.' };

  // Si le titre a changé, on garde le même slug (évite de casser les liens déjà partagés/indexés)
  // sauf si le guide n'a jamais été modifié depuis sa création — comportement volontairement simple ici.

  await prisma.$transaction([
    prisma.guideStep.deleteMany({ where: { guideId } }),
    prisma.repairGuide.update({
      where: { id: guideId },
      data: {
        title: data.title.trim(),
        excerpt: data.excerpt || null,
        coverImageUrl: data.coverImageUrl || null,
        modelId: data.modelId || null,
        difficulty: data.difficulty,
        estimatedTime: data.estimatedTime || null,
        toolsNeeded: data.toolsNeeded.filter(Boolean),
        partsNeeded: data.partsNeeded.filter(Boolean),
        published: data.published,
        metaTitle: data.metaTitle || null,
        metaDescription: data.metaDescription || null,
        steps: {
          create: data.steps.map((step, index) => ({
            order: index,
            title: step.title,
            contentHtml: step.contentHtml,
            imageUrl: step.imageUrl || null,
            warning: step.warning || null,
          })),
        },
      },
    }),
  ]);

  revalidatePath('/admin/guides');
  revalidatePath(`/admin/guides/${guideId}`);
  revalidatePath('/reparation');
  revalidatePath(`/reparation/guide/${existing.slug}`);

  return { ok: true };
}

export async function deleteGuide(guideId: string) {
  await requireAdminUser();
  await prisma.repairGuide.delete({ where: { id: guideId } });
  revalidatePath('/admin/guides');
  revalidatePath('/reparation');
  return { ok: true };
}

export async function togglePublished(guideId: string, published: boolean) {
  await requireAdminUser();
  await prisma.repairGuide.update({ where: { id: guideId }, data: { published } });
  revalidatePath('/admin/guides');
  revalidatePath('/reparation');
}
