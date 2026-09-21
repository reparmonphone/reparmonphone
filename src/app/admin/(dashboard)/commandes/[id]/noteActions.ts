'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdminUser } from '@/lib/supabase-server';
import { sendOrderNoteEmail } from '@/lib/orderEmails';

// Ajoute une note visible par le client sur sa commande (ex: retard transporteur indépendant de
// notre volonté) — envoie TOUJOURS un email au client en plus de l'afficher dans le détail de la
// commande, conformément à la demande de Krys (une note existe précisément pour prévenir le client).
export async function addOrderNote(orderId: string, message: string) {
  await requireAdminUser();

  const trimmed = message.trim();
  if (!trimmed) {
    return { error: 'Le message de la note ne peut pas être vide.' };
  }
  if (trimmed.length > 2000) {
    return { error: 'Le message est trop long (2000 caractères maximum).' };
  }

  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true } });
  if (!order) return { error: 'Commande introuvable.' };

  const note = await prisma.orderNote.create({
    data: { orderId, message: trimmed },
  });

  await sendOrderNoteEmail(orderId, trimmed);

  revalidatePath(`/admin/commandes/${orderId}`);
  revalidatePath('/compte/commandes');
  revalidatePath(`/compte/commandes/${orderId}`);
  return { ok: true, note: { id: note.id, message: note.message, createdAt: note.createdAt.toISOString() } };
}

// Retire une note affichée par erreur — l'email éventuellement déjà envoyé ne peut pas être rappelé,
// mais elle disparaît au moins du détail de la commande.
export async function deleteOrderNote(noteId: string) {
  await requireAdminUser();

  const note = await prisma.orderNote.findUnique({ where: { id: noteId } });
  if (!note) return { error: 'Note introuvable.' };

  await prisma.orderNote.delete({ where: { id: noteId } });

  revalidatePath(`/admin/commandes/${note.orderId}`);
  revalidatePath('/compte/commandes');
  revalidatePath(`/compte/commandes/${note.orderId}`);
  return { ok: true };
}
