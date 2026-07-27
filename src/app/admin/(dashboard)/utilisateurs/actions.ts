'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireAdminUser } from '@/lib/supabase-server';

export async function updateAdminUser(
  userId: string,
  data: {
    firstName: string;
    lastName: string;
    phone: string;
    addressLine1: string;
    addressCity: string;
    addressZip: string;
    isAdmin: boolean;
  }
) {
  const currentAdmin = await requireAdminUser();
  const supabaseAdmin = createSupabaseAdminClient();

  // Empêche un admin de se retirer lui-même son propre rôle (évite de se verrouiller dehors par erreur)
  if (currentAdmin.id === userId && !data.isAdmin) {
    return { error: 'Tu ne peux pas retirer ton propre rôle admin.' };
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    user_metadata: {
      first_name: data.firstName,
      last_name: data.lastName,
      full_name: `${data.firstName} ${data.lastName}`.trim(),
      phone: data.phone,
      address_line1: data.addressLine1,
      address_city: data.addressCity,
      address_zip: data.addressZip,
    },
    app_metadata: { role: data.isAdmin ? 'admin' : null },
  });

  if (error) return { error: error.message };

  revalidatePath('/admin/utilisateurs');
  revalidatePath(`/admin/utilisateurs/${userId}`);
  return { ok: true };
}

export async function deleteAdminUser(userId: string) {
  const currentAdmin = await requireAdminUser();

  if (currentAdmin.id === userId) {
    return { error: 'Tu ne peux pas supprimer ton propre compte depuis cette page.' };
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

  if (error) return { error: error.message };

  revalidatePath('/admin/utilisateurs');
  return { ok: true };
}
