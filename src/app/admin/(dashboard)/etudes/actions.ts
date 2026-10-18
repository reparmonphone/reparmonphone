'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdminUser } from '@/lib/supabase-server';
import { STUDY_IMPORTS } from '@/data/etudes';

type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';

function refresh(studyId?: string) {
  revalidatePath('/admin/etudes');
  if (studyId) revalidatePath(`/admin/etudes/${studyId}`);
}

/** Crée une étude prête à importer (voir src/data/etudes) avec ses actions. Ne fait rien si elle existe déjà. */
export async function importStudy(slug: string) {
  await requireAdminUser();
  const data = STUDY_IMPORTS.find((s) => s.slug === slug);
  if (!data) return { error: 'Étude inconnue.' };
  const existing = await prisma.study.findUnique({ where: { slug: data.slug } });
  if (existing) return { error: 'Cette étude est déjà importée.', id: existing.id };

  const now = new Date();
  const study = await prisma.study.create({
    data: {
      slug: data.slug,
      title: data.title,
      question: data.question,
      summary: data.summary,
      findings: Array.isArray(data.findings) ? data.findings.join('\n') : data.findings,
      report: data.report ?? null,
      tasks: {
        create: data.tasks.map((t, i) => ({
          title: t.title,
          description: t.description,
          notes: t.notes,
          status: t.status,
          order: i,
          doneAt: t.status === 'DONE' ? now : null,
        })),
      },
    },
  });
  refresh();
  return { ok: true, id: study.id };
}

export async function createStudy(data: { title: string; question: string }) {
  await requireAdminUser();
  const title = data.title.trim();
  if (!title) return { error: 'Le titre est obligatoire.' };
  const study = await prisma.study.create({ data: { title, question: data.question.trim() } });
  refresh();
  return { ok: true, id: study.id };
}

export async function updateStudy(
  id: string,
  data: { title: string; question: string; summary: string; findings: string; report: string }
) {
  await requireAdminUser();
  const title = data.title.trim();
  if (!title) return { error: 'Le titre est obligatoire.' };
  await prisma.study.update({
    where: { id },
    data: {
      title,
      question: data.question.trim(),
      summary: data.summary.trim(),
      findings: data.findings.trim(),
      report: data.report.trim() ? data.report : null,
    },
  });
  refresh(id);
  return { ok: true };
}

export async function deleteStudy(id: string) {
  await requireAdminUser();
  await prisma.study.delete({ where: { id } });
  refresh();
  return { ok: true };
}

export async function addStudyTask(studyId: string, data: { title: string; description: string }) {
  await requireAdminUser();
  const title = data.title.trim();
  if (!title) return { error: "Le titre de l'action est obligatoire." };
  const last = await prisma.studyTask.findFirst({ where: { studyId }, orderBy: { order: 'desc' } });
  await prisma.studyTask.create({
    data: { studyId, title, description: data.description.trim(), order: (last?.order ?? -1) + 1 },
  });
  refresh(studyId);
  return { ok: true };
}

export async function updateStudyTask(
  id: string,
  data: { title?: string; description?: string; notes?: string; status?: TaskStatus }
) {
  await requireAdminUser();
  const current = await prisma.studyTask.findUnique({ where: { id } });
  if (!current) return { error: 'Action introuvable.' };

  const patch: {
    title?: string;
    description?: string;
    notes?: string;
    status?: TaskStatus;
    doneAt?: Date | null;
  } = {};
  if (data.title !== undefined) {
    if (!data.title.trim()) return { error: 'Le titre ne peut pas être vide.' };
    patch.title = data.title.trim();
  }
  if (data.description !== undefined) patch.description = data.description.trim();
  if (data.notes !== undefined) patch.notes = data.notes.trim();
  if (data.status !== undefined && data.status !== current.status) {
    patch.status = data.status;
    patch.doneAt = data.status === 'DONE' ? new Date() : null;
  }

  await prisma.studyTask.update({ where: { id }, data: patch });
  refresh(current.studyId);
  return { ok: true };
}

export async function deleteStudyTask(id: string) {
  await requireAdminUser();
  const current = await prisma.studyTask.findUnique({ where: { id } });
  if (!current) return { ok: true };
  await prisma.studyTask.delete({ where: { id } });
  refresh(current.studyId);
  return { ok: true };
}
