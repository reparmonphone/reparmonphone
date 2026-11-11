'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { createSupabaseServerClient } from '@/lib/supabase-server';

const MAX_DEVICES = 5;

async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

// Ajoute un téléphone/une tablette au compte du client connecté (5 maximum, sans doublon).
export async function addDevice(modelId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Connectez-vous pour enregistrer votre appareil.' };

  const model = await prisma.model.findUnique({ where: { id: String(modelId) }, select: { id: true } });
  if (!model) return { ok: false, error: 'Modèle introuvable.' };

  const existing = await prisma.userDevice.findMany({ where: { userId: user.id }, select: { modelId: true } });
  if (existing.some((d) => d.modelId === model.id)) return { ok: true };
  if (existing.length >= MAX_DEVICES) {
    return { ok: false, error: `Vous pouvez enregistrer ${MAX_DEVICES} appareils au maximum. Supprimez-en un d’abord.` };
  }

  await prisma.userDevice.create({ data: { userId: user.id, modelId: model.id } });
  revalidatePath('/compte/appareils');
  return { ok: true };
}

export async function removeDevice(id: string): Promise<{ ok: true }> {
  const user = await getCurrentUser();
  if (user) {
    await prisma.userDevice.deleteMany({ where: { id: String(id), userId: user.id } });
    revalidatePath('/compte/appareils');
  }
  return { ok: true };
}
